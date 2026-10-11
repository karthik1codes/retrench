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

    found: list[dict[str, Any]] = []

    if domain:
        try:
            enriched = crust.company_enrich(domains=[domain])
            found = [r for r in _as_list(enriched) if _usable_company(r)]
        except Exception:
            found = []
        if not found:
            filters: list[dict[str, Any]] = [
                {"field": "basic_info.primary_domain", "type": "=", "value": domain}
            ]
            try:
                found = [
                    r
                    for r in crust.company_search(
                        filters,
                        limit=5,
                        fields=cfg.crustdata_fields or None,
                    )
                    if _usable_company(r)
                ]
            except Exception:
                found = []

    if not found:
        query = name or domain
        try:
            found = [
                r
                for r in crust.company_search(
                    cfg.crustdata_filters,
                    limit=5,
                    search={"query": query, "mode": "hybrid"},
                    fields=cfg.crustdata_fields or None,
                )
                if _usable_company(r)
            ]
        except Exception:
            found = []

    # Last resort: still scout the typed domain so the user gets a profile/draft path
    if not found and domain:
        found = [
            {
                "basic_info": {
                    "name": _title_from_domain(domain),
                    "primary_domain": domain,
                },
                "domain": domain,
                "name": _title_from_domain(domain),
            }
        ]

    return [_hydrate_query_identity(r, domain=domain, name=name) for r in found]


def _title_from_domain(domain: str) -> str:
    base = domain.split(".")[0].replace("-", " ").replace("_", " ").strip()
    return base.title() if base else domain


def _usable_company(row: dict[str, Any]) -> bool:
    basic = row.get("basic_info") if isinstance(row.get("basic_info"), dict) else {}
    name = basic.get("name") or row.get("name") or row.get("company_name")
    domain = basic.get("primary_domain") or row.get("domain") or row.get("primary_domain")
    for val in (name, domain):
        if val is None:
            continue
        s = str(val).strip()
        if s and s.lower() not in {"none", "null", "undefined", "unknown", "n/a"}:
            return True
    return False


def _hydrate_query_identity(
    raw: dict[str, Any],
    *,
    domain: str | None,
    name: str | None,
) -> dict[str, Any]:
    """Ensure domain/name from the user query survive hollow API payloads."""
    out = dict(raw)
    basic = out.get("basic_info") if isinstance(out.get("basic_info"), dict) else {}
    basic = dict(basic)

    def blank(v: Any) -> bool:
        if v is None:
            return True
        s = str(v).strip()
        return not s or s.lower() in {"none", "null", "undefined", "unknown", "n/a"}

    if domain and blank(basic.get("primary_domain")) and blank(out.get("domain")):
        basic["primary_domain"] = domain
        out["domain"] = domain
    if name and blank(basic.get("name")) and blank(out.get("name")):
        basic["name"] = name
        out["name"] = name
    if domain and blank(basic.get("name")) and blank(out.get("name")):
        basic["name"] = _title_from_domain(domain)
        out["name"] = basic["name"]
    if basic:
        out["basic_info"] = basic
    return out


def _as_list(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        # enrich sometimes returns the company object itself
        if isinstance(data.get("basic_info"), dict) or data.get("domain") or data.get("name"):
            if _usable_company(data) or data.get("basic_info") is not None:
                return [data]
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

    matched = dict(companies[0])
    matched["is_new_funding"] = True
    matched["force_scout_signal"] = True
    company_ctx = _company_context(matched)
    scouted = _scouted_content(matched, company_ctx)
    month = datetime.now(timezone.utc).strftime("%Y-%m")

    # Guard: never proceed with literal "None" identity
    if not company_ctx.get("name") or str(company_ctx.get("name")).lower() == "none":
        return {
            "status": "failed",
            "error": "company resolve returned an empty profile — try a clearer domain",
            "domain": domain,
            "name": name,
            "credits_spent": ledger.total,
            "matched_company": company_ctx,
            "context": {"scouted": scouted, "month": month},
        }

    result = run_cycle(
        config_path,
        companies_override=[matched],
        write_digest=True,
    )
    result["query"] = {"domain": domain, "name": name}
    result["matched_company"] = company_ctx
    result["resolve_credits"] = ledger.total

    lookup = company_ctx.get("domain") or domain or company_ctx.get("name") or name or ""
    try:
        from signalscout.http_api import drafts_for_company

        # Recent signals for this company (not hourly-cycle scoped)
        items = drafts_for_company(str(lookup), month="recent") if lookup else []
        if not items and lookup:
            items = drafts_for_company(str(lookup), month="current")
    except Exception:  # noqa: BLE001
        items = []
    formatted_items: list[dict[str, Any]] = []
    for i in items:
        row = dict(i)
        raw_summary = row.get("summary")
        row["implication"] = row.get("implication") or _extract_implication(raw_summary)
        row["summary"] = _clean_signal_summary(raw_summary)
        formatted_items.append(row)
    result["items"] = formatted_items
    created = result.get("created_signals") or []
    drafts = result.get("drafts") or []
    result["context"] = {
        "company": company_ctx,
        "scouted": scouted,
        "month": month,
        "signals_created": len(created),
        "drafts_created": len(drafts),
        "signals_this_month": len(formatted_items),
        "signals_in_graph": len(formatted_items),
        "note": _context_note(
            company_ctx, len(created), len(formatted_items), len(drafts), month
        ),
        "signals": [
            {
                "type": i.get("type") or i.get("state") or "signal",
                "summary": i.get("summary"),
                "implication": i.get("implication"),
                "severity": i.get("severity"),
                "state": i.get("state"),
                "detected_at": i.get("detected_at"),
                "has_draft": bool(i.get("draft_body")),
                "confidence": i.get("confidence"),
            }
            for i in formatted_items
        ],
    }
    return result


def _extract_implication(summary: Any) -> str | None:
    if not summary:
        return None
    text = str(summary)
    marker = "Why it matters:"
    if marker.lower() in text.lower():
        idx = text.lower().index(marker.lower())
        return text[idx + len(marker) :].strip(" |") or None
    return None


def _clean_signal_summary(summary: Any) -> str | None:
    if not summary:
        return None
    text = str(summary)
    idx = text.lower().find(" | why it matters:")
    if idx >= 0:
        return text[:idx].strip()
    idx2 = text.lower().find("why it matters:")
    if idx2 > 0:
        return text[:idx2].strip(" |")
    return text.strip()


def _context_note(
    company: dict[str, Any],
    created: int,
    recent_count: int,
    drafts: int,
    month: str,
) -> str:
    label = company.get("name") or company.get("domain") or "Company"
    if drafts and recent_count:
        return f"{label}: {recent_count} recent signal(s), {drafts} draft(s) ready"
    if created:
        return f"{label}: {created} new signal(s) this scout · drafting from live profile"
    if recent_count:
        return f"{label}: {recent_count} recent signal(s) in {month}"
    return f"{label}: profile saved — open draft workspace after signals qualify"


def _company_context(raw: dict[str, Any]) -> dict[str, Any]:
    try:
        norm = normalize_company(raw)
    except ValueError:
        return {
            "name": None,
            "domain": raw.get("domain"),
            "industry": None,
            "description": None,
            "employee_range": None,
            "headcount": None,
            "funding_stage": None,
            "last_funding_date": None,
            "last_funding_amount": None,
            "headcount_growth_30d_pct": None,
            "country": None,
        }
    growth = norm.get("headcount_growth_30d_pct")
    if isinstance(growth, (int, float)):
        growth = round(float(growth), 1)
    return {
        "name": norm.get("name"),
        "domain": norm.get("domain"),
        "industry": norm.get("industry") or None,
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
    try:
        norm = normalize_company(raw)
    except ValueError:
        norm = {"jobs": [], "people": []}
    highlights: list[str] = []
    if company.get("name") and str(company["name"]).lower() != "none":
        highlights.append(f"Matched {company['name']}")
    if company.get("domain"):
        highlights.append(f"Domain {company['domain']}")
    if company.get("industry"):
        highlights.append(f"Industry: {company['industry']}")
    elif company.get("employee_range"):
        highlights.append(f"Size band: {company['employee_range']}")
    else:
        highlights.append("Industry not returned by source for this company")
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
