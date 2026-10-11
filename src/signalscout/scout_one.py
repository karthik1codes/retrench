"""Scout a single SaaS company by domain or name (CrustData → graph → draft)."""

from __future__ import annotations

from typing import Any

from signalscout.config import SegmentConfig, load_segment
from signalscout.crustdata import CrustDataClient
from signalscout.orchestrator import run_cycle


def resolve_companies(
    crust: CrustDataClient,
    cfg: SegmentConfig,
    *,
    domain: str | None = None,
    name: str | None = None,
) -> list[dict[str, Any]]:
    domain = (domain or "").strip().lower().removeprefix("https://").removeprefix("http://").split("/")[0]
    name = (name or "").strip()
    if not domain and not name:
        raise ValueError("domain or name required")

    if domain:
        try:
            enriched = crust.company_enrich(domains=[domain])
            rows = _as_list(enriched)
            if rows:
                return rows
        except Exception:
            pass
        filters: list[dict[str, Any]] = [
            {"field": "basic_info.primary_domain", "type": "=", "value": domain}
        ]
        found = crust.company_search(
            filters,
            limit=5,
            fields=cfg.crustdata_fields or None,
        )
        if found:
            return found

    query = name or domain
    return crust.company_search(
        cfg.crustdata_filters,
        limit=5,
        search={"query": query, "mode": "hybrid"},
        fields=cfg.crustdata_fields or None,
    )


def _as_list(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        for key in ("companies", "results", "data", "items"):
            val = data.get(key)
            if isinstance(val, list):
                return [x for x in val if isinstance(x, dict)]
            if isinstance(val, dict) and isinstance(val.get("results"), list):
                return [x for x in val["results"] if isinstance(x, dict)]
    return []


def scout_company(
    *,
    config_path: str = "segment.yaml",
    domain: str | None = None,
    name: str | None = None,
) -> dict[str, Any]:
    cfg = load_segment(config_path)
    # Temporary client only for resolve; run_cycle creates its own
    from signalscout.crustdata import CreditLedger

    ledger = CreditLedger()
    crust = CrustDataClient(ledger=ledger)
    try:
        companies = resolve_companies(crust, cfg, domain=domain, name=name)
    finally:
        crust.close()

    if not companies:
        return {
            "status": "failed",
            "error": "no company matched",
            "domain": domain,
            "name": name,
            "credits_spent": ledger.total,
        }

    # First match only; mark as new so Signal Agent emits a draftable trigger
    matched = dict(companies[0])
    matched["is_new_funding"] = True

    result = run_cycle(
        config_path,
        companies_override=[matched],
        write_digest=True,
    )
    result["query"] = {"domain": domain, "name": name}
    result["matched_company"] = _company_label(companies[0])
    result["resolve_credits"] = ledger.total
    return result


def _company_label(raw: dict[str, Any]) -> dict[str, Any]:
    basic = raw.get("basic_info") if isinstance(raw.get("basic_info"), dict) else {}
    return {
        "name": basic.get("name") or raw.get("name") or raw.get("company_name"),
        "domain": basic.get("primary_domain") or raw.get("domain") or raw.get("primary_domain"),
    }
