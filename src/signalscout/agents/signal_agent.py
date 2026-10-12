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

    def _clean(val: Any) -> Any:
        if val is None:
            return None
        if isinstance(val, str):
            s = val.strip()
            if not s or s.lower() in {"none", "null", "undefined", "unknown", "n/a"}:
                return None
            return s
        return val

    cd_id = _clean(
        raw.get("crustdata_company_id")
        or raw.get("crustdata_id")
        or raw.get("company_id")
        or raw.get("id")
        or basic.get("company_id")
        or basic.get("primary_domain")
        or basic.get("name")
        or raw.get("domain")
        or raw.get("name")
        or raw.get("primary_domain")
    )
    name = _clean(basic.get("name") or raw.get("name") or raw.get("company_name"))
    domain = _clean(
        basic.get("primary_domain") or raw.get("domain") or raw.get("primary_domain")
    )
    if not cd_id:
        cd_id = domain or name
    if not name:
        name = domain or (str(cd_id) if cd_id else None)
    round_type = funding.get("last_round_type") or raw.get("funding_stage")
    amount = funding.get("last_round_amount_usd") or raw.get("last_funding_amount")
    if isinstance(amount, (int, float)):
        amount = f"${amount:,.0f}"

    industry = (
        taxonomy.get("professional_network_industry")
        or taxonomy.get("linkedin_industry")
        or taxonomy.get("industry")
        or raw.get("industry")
        or taxonomy.get("crunchbase_categories")
        or taxonomy.get("linkedin_industries")
    )
    if isinstance(industry, list):
        industry = ", ".join(str(x) for x in industry if x)[:120] or None

    description = (
        basic.get("description")
        or basic.get("short_description")
        or raw.get("description")
        or raw.get("short_description")
    )
    employee_range = basic.get("employee_count_range") or raw.get("employee_count_range")
    logo_url = _clean(
        basic.get("logo_permalink")
        or raw.get("logo_permalink")
        or raw.get("logo_url")
        or raw.get("logo")
    )

    if not cd_id:
        raise ValueError("company payload missing id/name/domain")

    return {
        "crustdata_id": str(cd_id),
        "name": name or str(cd_id),
        "domain": domain,
        "industry": industry,
        "description": description,
        "logo_url": logo_url,
        "employee_range": employee_range,
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
            try:
                company = normalize_company(raw)
            except ValueError:
                continue
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
        force_scout = bool(
            (company.get("_raw") or {}).get("force_scout_signal")
            or (company.get("_raw") or {}).get("is_new_funding")
        )

        # funding — fire once per funding fingerprint (idempotent MERGE on signal id)
        if t.funding.enabled and company.get("last_funding_date") and company.get("funding_stage"):
            funding_fp = f"{company.get('funding_stage')}:{company.get('last_funding_date')}:{company.get('last_funding_amount')}"
            stage_changed = (not prev) or (
                prev.get("funding_stage") != company.get("funding_stage")
            )
            is_new = force_scout or stage_changed
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
                        "summary": (
                            f"{company['name']} headcount +{float(growth):.1f}% in 30 days"
                        ),
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

        # Interactive scout: always emit at least one draftable profile signal
        # from live company facts when classic triggers did not fire.
        # Never mention data vendors (CrustData) — drafts must sound company-native.
        if force_scout and not out:
            label = company.get("name") or company.get("domain") or cid
            domain = company.get("domain") or ""
            desc = str(company.get("description") or "").strip()
            if len(desc) > 140:
                desc = desc[:137].rstrip() + "…"
            angle_bits: list[str] = []
            if desc:
                angle_bits.append(desc)
            if company.get("industry"):
                angle_bits.append(f"in {company['industry']}")
            if company.get("funding_stage") or company.get("last_funding_amount"):
                angle_bits.append(
                    " ".join(
                        str(x)
                        for x in (
                            company.get("funding_stage"),
                            company.get("last_funding_amount"),
                            company.get("last_funding_date")
                            and f"({company.get('last_funding_date')})",
                        )
                        if x
                    )
                )
            if company.get("headcount") is not None:
                angle_bits.append(f"{company['headcount']} employees")
            growth = company.get("headcount_growth_30d_pct")
            if growth is not None:
                angle_bits.append(f"+{float(growth):.1f}% headcount / 30d")
            if company.get("employee_range"):
                angle_bits.append(f"size {company['employee_range']}")
            if company.get("country"):
                angle_bits.append(f"HQ {company['country']}")
            fact_line = "; ".join(angle_bits) if angle_bits else (
                f"{label} is actively building GTM motion on {domain or 'their site'}"
            )
            fp = f"profile:{domain}:{company.get('funding_stage')}:{company.get('headcount')}:{company.get('last_funding_date')}"
            sid = _signal_id(cid, "profile", fp)
            out.append(
                {
                    "id": sid,
                    "type": "profile",
                    "severity": 78,
                    "summary": f"{label} snapshot: {fact_line}".strip(),
                    "payload": {
                        "company_id": cid,
                        "name": company.get("name"),
                        "domain": domain,
                        "industry": company.get("industry"),
                        "description": company.get("description"),
                        "funding_stage": company.get("funding_stage"),
                        "last_funding_date": company.get("last_funding_date"),
                        "last_funding_amount": company.get("last_funding_amount"),
                        "headcount": company.get("headcount"),
                        "headcount_growth_30d_pct": company.get("headcount_growth_30d_pct"),
                        "country": company.get("country"),
                    },
                }
            )

        return out
