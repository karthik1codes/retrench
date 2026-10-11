"""Scout a single SaaS company by domain or name (CrustData → graph → draft)."""

from __future__ import annotations

from typing import Any

from signalscout.agents.signal_agent import normalize_company
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
    company_ctx = _company_context(companies[0])

    result = run_cycle(
        config_path,
        companies_override=[matched],
        write_digest=True,
    )
    result["query"] = {"domain": domain, "name": name}
    result["matched_company"] = company_ctx
    result["resolve_credits"] = ledger.total

    # Always attach live signal/draft rows from the graph for this company
    lookup = (
        company_ctx.get("domain")
        or company_ctx.get("name")
        or domain
        or name
        or ""
    )
    try:
        from signalscout.http_api import drafts_for_company

        items = drafts_for_company(str(lookup)) if lookup else []
    except Exception:  # noqa: BLE001
        items = []
    result["items"] = items
    created = result.get("created_signals") or []
    drafts = result.get("drafts") or []
    result["context"] = {
        "company": company_ctx,
        "signals_created": len(created),
        "drafts_created": len(drafts),
        "signals_in_graph": len(items),
        "note": _context_note(company_ctx, len(created), len(items)),
        "signals": [
            {
                "type": i.get("type") or i.get("state") or "signal",
                "summary": i.get("summary"),
                "severity": i.get("severity"),
                "state": i.get("state"),
                "detected_at": i.get("detected_at"),
                "has_draft": bool(i.get("draft_body")),
                "confidence": i.get("confidence"),
            }
            for i in items
        ],
    }
    return result


def _context_note(company: dict[str, Any], created: int, in_graph: int) -> str:
    bits: list[str] = []
    if company.get("industry"):
        bits.append(str(company["industry"]))
    if company.get("funding_stage"):
        stage = str(company["funding_stage"])
        if company.get("last_funding_amount"):
            stage = f"{stage} ({company['last_funding_amount']})"
        bits.append(stage)
    if company.get("headcount"):
        bits.append(f"{company['headcount']} employees")
    growth = company.get("headcount_growth_30d_pct")
    if isinstance(growth, (int, float)) and growth:
        bits.append(f"{growth}% headcount growth (30d)")
    if created:
        bits.append(f"{created} new signal{'s' if created != 1 else ''} this run")
    elif in_graph:
        bits.append(f"{in_graph} existing signal{'s' if in_graph != 1 else ''} in graph")
    else:
        bits.append("no qualifying signals yet — company profile stored for next cycle")
    return " · ".join(bits)


def _company_context(raw: dict[str, Any]) -> dict[str, Any]:
    norm = normalize_company(raw)
    growth = norm.get("headcount_growth_30d_pct")
    if isinstance(growth, (int, float)):
        growth = round(float(growth), 1)
    return {
        "name": norm.get("name"),
        "domain": norm.get("domain"),
        "industry": norm.get("industry") or "Uncategorized",
        "headcount": norm.get("headcount"),
        "funding_stage": norm.get("funding_stage"),
        "last_funding_date": norm.get("last_funding_date"),
        "last_funding_amount": norm.get("last_funding_amount"),
        "headcount_growth_30d_pct": growth,
        "country": norm.get("country"),
    }
