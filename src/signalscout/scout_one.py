"""Scout a single SaaS company by domain or name (CrustData → graph → draft)."""

from __future__ import annotations

from datetime import datetime, timezone
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
    scouted = _scouted_content(companies[0], company_ctx)
    month = datetime.now(timezone.utc).strftime("%Y-%m")

    result = run_cycle(
        config_path,
        companies_override=[matched],
        write_digest=True,
    )
    result["query"] = {"domain": domain, "name": name}
    result["matched_company"] = company_ctx
    result["resolve_credits"] = ledger.total

    # Current calendar month signals (not hourly-cycle scoped)
    lookup = (
        company_ctx.get("domain")
        or company_ctx.get("name")
        or domain
        or name
        or ""
    )
    try:
        from signalscout.http_api import drafts_for_company

        items = (
            drafts_for_company(str(lookup), month="current") if lookup else []
        )
    except Exception:  # noqa: BLE001
        items = []
    result["items"] = items
    created = result.get("created_signals") or []
    drafts = result.get("drafts") or []
    result["context"] = {
        "company": company_ctx,
        "scouted": scouted,
        "month": month,
        "signals_created": len(created),
        "drafts_created": len(drafts),
        "signals_this_month": len(items),
        "signals_in_graph": len(items),
        "note": _context_note(company_ctx, len(created), len(items), month),
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


def _context_note(
    company: dict[str, Any], created: int, month_count: int, month: str
) -> str:
    """Human-readable status — not tied to the hourly timer."""
    if month_count:
        return (
            f"{month_count} signal{'s' if month_count != 1 else ''} in {month}"
            + (f" · {created} new this scout" if created else "")
        )
    if created:
        return f"{created} new signal{'s' if created != 1 else ''} this scout · {month}"
    return (
        f"No funding / headcount / exec triggers in {month} yet. "
        "Live company profile below is what the agent fetched and stored."
    )


def _company_context(raw: dict[str, Any]) -> dict[str, Any]:
    norm = normalize_company(raw)
    growth = norm.get("headcount_growth_30d_pct")
    if isinstance(growth, (int, float)):
        growth = round(float(growth), 1)
    industry = norm.get("industry")
    return {
        "name": norm.get("name"),
        "domain": norm.get("domain"),
        "industry": industry or None,
        "description": norm.get("description"),
        "employee_range": norm.get("employee_range"),
        "headcount": norm.get("headcount"),
        "funding_stage": norm.get("funding_stage"),
        "last_funding_date": norm.get("last_funding_date"),
        "last_funding_amount": norm.get("last_funding_amount"),
        "headcount_growth_30d_pct": growth,
        "country": norm.get("country"),
    }


def _scouted_content(raw: dict[str, Any], company: dict[str, Any]) -> dict[str, Any]:
    """Structured facts the agent actually pulled (shown even with 0 signals)."""
    norm = normalize_company(raw)
    highlights: list[str] = []
    if company.get("name"):
        highlights.append(f"Matched {company['name']}")
    if company.get("domain"):
        highlights.append(f"Domain {company['domain']}")
    if company.get("industry"):
        highlights.append(f"Industry: {company['industry']}")
    elif company.get("employee_range"):
        highlights.append(f"Size band: {company['employee_range']}")
    else:
        highlights.append(
            "Industry not in source data for this company (shown as unknown, not a cycle issue)"
        )
    if company.get("description"):
        desc = str(company["description"]).strip()
        if len(desc) > 220:
            desc = desc[:217].rstrip() + "…"
        highlights.append(desc)
    if company.get("funding_stage") or company.get("last_funding_amount"):
        bits = [
            x
            for x in (
                company.get("funding_stage"),
                company.get("last_funding_amount"),
                company.get("last_funding_date")
                and f"announced {company.get('last_funding_date')}",
            )
            if x
        ]
        highlights.append("Funding: " + " · ".join(str(b) for b in bits))
    if company.get("headcount") is not None:
        line = f"Headcount: {company['headcount']}"
        growth = company.get("headcount_growth_30d_pct")
        if isinstance(growth, (int, float)):
            line += f" ({growth:+.1f}% / 30d)"
        highlights.append(line)
    elif company.get("employee_range"):
        highlights.append(f"Employee range: {company['employee_range']}")
    if company.get("country"):
        highlights.append(f"HQ: {company['country']}")

    jobs = norm.get("jobs") or []
    people = norm.get("people") or []
    if isinstance(jobs, list) and jobs:
        highlights.append(f"{len(jobs)} open roles in payload")
    if isinstance(people, list) and people:
        titles = [
            p.get("title") or p.get("name")
            for p in people[:3]
            if isinstance(p, dict)
        ]
        titles = [t for t in titles if t]
        highlights.append(
            f"{len(people)} people in payload"
            + (f" ({', '.join(str(t) for t in titles)})" if titles else "")
        )

    return {
        "highlights": highlights,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "fields": {
            "name": company.get("name"),
            "domain": company.get("domain"),
            "industry": company.get("industry"),
            "description": company.get("description"),
            "funding_stage": company.get("funding_stage"),
            "last_funding_date": company.get("last_funding_date"),
            "last_funding_amount": company.get("last_funding_amount"),
            "headcount": company.get("headcount"),
            "headcount_growth_30d_pct": company.get("headcount_growth_30d_pct"),
            "employee_range": company.get("employee_range"),
            "country": company.get("country"),
        },
    }
