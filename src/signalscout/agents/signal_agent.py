"""Signal Agent — CrustData universe + graph diff → :Signal nodes."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

from signalscout.config import SegmentConfig
from signalscout.crustdata import CrustDataClient
from signalscout.evidence_store import EvidenceStore
from signalscout.graph import GraphStore


def _signal_id(company_id: str, signal_type: str, fingerprint: str) -> str:
    h = hashlib.sha256(f"{company_id}:{signal_type}:{fingerprint}".encode()).hexdigest()[:16]
    return f"sig-{signal_type}-{h}"


def normalize_company(raw: dict[str, Any]) -> dict[str, Any]:
    """Map CrustData / mock payloads into graph company fields."""
    basic = raw.get("basic_info") if isinstance(raw.get("basic_info"), dict) else {}
    funding = raw.get("funding") if isinstance(raw.get("funding"), dict) else {}
    headcount = raw.get("headcount") if isinstance(raw.get("headcount"), dict) else {}
    locations = raw.get("locations") if isinstance(raw.get("locations"), dict) else {}
    taxonomy = raw.get("taxonomy") if isinstance(raw.get("taxonomy"), dict) else {}
    growth = headcount.get("growth_percent") if isinstance(headcount.get("growth_percent"), dict) else {}

    cd_id = (
        raw.get("crustdata_company_id")
        or raw.get("crustdata_id")
        or raw.get("company_id")
        or raw.get("id")
        or basic.get("company_id")
        or basic.get("primary_domain")
        or basic.get("name")
        or raw.get("domain")
        or raw.get("name")
    )
    round_type = funding.get("last_round_type") or raw.get("funding_stage")
    amount = funding.get("last_round_amount_usd") or raw.get("last_funding_amount")
    if isinstance(amount, (int, float)):
        amount = f"${amount:,.0f}"

    return {
        "crustdata_id": str(cd_id),
        "name": basic.get("name") or raw.get("name") or raw.get("company_name") or str(cd_id),
        "domain": basic.get("primary_domain") or raw.get("domain") or raw.get("primary_domain"),
        "industry": taxonomy.get("professional_network_industry") or raw.get("industry"),
        "headcount": headcount.get("total") or raw.get("headcount") or raw.get("employee_count"),
        "funding_stage": round_type,
        "country": locations.get("country") or raw.get("country") or raw.get("hq_country"),
        "last_funding_date": funding.get("last_fundraise_date") or raw.get("last_funding_date"),
        "last_funding_amount": amount,
        "headcount_growth_30d_pct": growth.get("1m")
        or raw.get("headcount_growth_30d_pct"),
        "jobs": raw.get("jobs") or [],
        "people": raw.get("people") or [],
        "_raw": raw,
    }


class SignalAgent:
    def __init__(
        self,
        graph: GraphStore,
        crust: CrustDataClient,
        evidence: EvidenceStore,
        cfg: SegmentConfig,
        *,
        companies_override: list[dict[str, Any]] | None = None,
    ):
        self.graph = graph
        self.crust = crust
        self.evidence = evidence
        self.cfg = cfg
        self.companies_override = companies_override

    def run(self, run_id: str, segment_id: str) -> list[str]:
        created: list[str] = []
        if self.companies_override is not None:
            companies_raw = self.companies_override
        else:
            if self.crust.ledger.total >= self.cfg.credit_budget_per_cycle:
                return created
            companies_raw = self.crust.company_search(
                self.cfg.crustdata_filters,
                limit=self.cfg.limit_companies,
                search=self.cfg.search,
                fields=self.cfg.crustdata_fields or None,
            )

        for raw in companies_raw:
            if self.crust.ledger.total >= self.cfg.credit_budget_per_cycle:
                break
            company = normalize_company(raw)
            prev = self.graph.company_snapshot(company["crustdata_id"])
            self.graph.merge_company(company, segment_id)
            for sig in self._diff_signals(company, prev):
                s3_key, _ = self.evidence.put(
                    f"evidence/{sig['id']}.json",
                    sig["payload"],
                    source="crustdata",
                )
                eh = self.graph.merge_evidence(s3_key, "crustdata", sig["payload"])
                new = self.graph.create_signal_if_new(
                    signal_id=sig["id"],
                    signal_type=sig["type"],
                    severity=sig["severity"],
                    summary=sig["summary"],
                    company_id=company["crustdata_id"],
                    evidence_hash=eh,
                    run_id=run_id,
                )
                if new:
                    created.append(sig["id"])
        return created

    def _diff_signals(
        self, company: dict[str, Any], prev: dict[str, Any] | None
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        cid = company["crustdata_id"]
        t = self.cfg.triggers

        # funding — fire once per funding fingerprint (idempotent MERGE on signal id)
        if t.funding.enabled and company.get("last_funding_date") and company.get("funding_stage"):
            funding_fp = f"{company.get('funding_stage')}:{company.get('last_funding_date')}:{company.get('last_funding_amount')}"
            stage_changed = (not prev) or (
                prev.get("funding_stage") != company.get("funding_stage")
            )
            is_new = bool(company.get("_raw", {}).get("is_new_funding")) or stage_changed
            if is_new:
                sid = _signal_id(cid, "funding", funding_fp)
                amt = company.get("last_funding_amount") or ""
                out.append(
                    {
                        "id": sid,
                        "type": "funding",
                        "severity": t.funding.min_severity,
                        "summary": (
                            f"{company['name']} raised {amt} "
                            f"{company.get('funding_stage')} (announced {company.get('last_funding_date')})"
                        ).strip(),
                        "payload": {
                            "company_id": cid,
                            "funding_stage": company.get("funding_stage"),
                            "last_funding_date": company.get("last_funding_date"),
                            "last_funding_amount": company.get("last_funding_amount"),
                        },
                    }
                )

        # headcount surge
        if t.headcount_surge.enabled:
            growth = company.get("headcount_growth_30d_pct")
            if growth is not None and float(growth) >= t.headcount_surge.min_pct_30d:
                fp = f"hc:{growth}:{company.get('headcount')}"
                sid = _signal_id(cid, "headcount_surge", fp)
                out.append(
                    {
                        "id": sid,
                        "type": "headcount_surge",
                        "severity": t.headcount_surge.min_severity,
                        "summary": f"{company['name']} headcount +{growth}% in 30 days",
                        "payload": {
                            "company_id": cid,
                            "headcount_growth_30d_pct": growth,
                            "headcount": company.get("headcount"),
                            "jobs": company.get("jobs"),
                        },
                    }
                )

        # exec hire
        if t.exec_hire.enabled:
            titles = {x.lower() for x in t.exec_hire.titles}
            for person in company.get("people") or []:
                title = (person.get("title") or "").lower()
                if any(t_ in title for t_ in titles) or title in titles:
                    pid = person.get("crustdata_id") or person.get("name")
                    fp = f"exec:{pid}:{person.get('title')}:{person.get('tenure_start')}"
                    sid = _signal_id(cid, "exec_hire", fp)
                    out.append(
                        {
                            "id": sid,
                            "type": "exec_hire",
                            "severity": t.exec_hire.min_severity,
                            "summary": (
                                f"{person.get('name')} joined {company['name']} as {person.get('title')} "
                                f"({person.get('tenure_start')})"
                            ),
                            "payload": {"company_id": cid, "person": person},
                        }
                    )

        return out
