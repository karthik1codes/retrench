"""Find decision-maker business emails via CrustData person search + contact enrich."""

from __future__ import annotations

from typing import Any

from signalscout.crustdata import CreditLedger, CrustDataClient

DEFAULT_TITLES = [
    "VP Sales",
    "CRO",
    "Head of Sales",
    "Chief Revenue",
    "Founder",
    "CEO",
    "Co-Founder",
]


def _profile_url(person: dict[str, Any]) -> str | None:
    handles = person.get("social_handles")
    if isinstance(handles, dict):
        pn = handles.get("professional_network_identifier")
        if isinstance(pn, dict) and pn.get("profile_url"):
            return str(pn["profile_url"])
    for key in (
        "professional_network_profile_url",
        "profile_url",
        "linkedin_url",
    ):
        if person.get(key):
            return str(person[key])
    return None


def _name_title(person: dict[str, Any]) -> tuple[str, str]:
    basic = person.get("basic_profile") if isinstance(person.get("basic_profile"), dict) else {}
    name = str(basic.get("name") or person.get("name") or "Unknown")
    title = str(
        basic.get("current_title")
        or person.get("title")
        or person.get("current_title")
        or ""
    )
    return name, title


def _emails_from_contact_payload(data: Any) -> dict[str, list[str]]:
    """Map profile URL → business emails from /person/contact/enrich response."""
    out: dict[str, list[str]] = {}
    rows = data if isinstance(data, list) else []
    if isinstance(data, dict):
        for key in ("results", "data", "items"):
            if isinstance(data.get(key), list):
                rows = data[key]
                break

    for row in rows:
        if not isinstance(row, dict):
            continue
        matched = str(row.get("matched_on") or "")
        emails: list[str] = []
        matches = row.get("matches") if isinstance(row.get("matches"), list) else []
        for m in matches:
            if not isinstance(m, dict):
                continue
            pd = m.get("person_data") if isinstance(m.get("person_data"), dict) else m
            contact = pd.get("contact") if isinstance(pd.get("contact"), dict) else {}
            raw_emails = contact.get("business_emails") or pd.get("business_emails") or []
            emails.extend(_normalize_emails(raw_emails))
        if matched:
            out[matched] = list(dict.fromkeys(emails))
    return out


def _normalize_emails(raw: Any) -> list[str]:
    emails: list[str] = []
    if isinstance(raw, str) and "@" in raw:
        emails.append(raw.strip().lower())
        return emails
    if not isinstance(raw, list):
        return emails
    for item in raw:
        if isinstance(item, str) and "@" in item:
            emails.append(item.strip().lower())
        elif isinstance(item, dict):
            for k in ("email", "address", "value", "business_email"):
                v = item.get(k)
                if isinstance(v, str) and "@" in v:
                    emails.append(v.strip().lower())
                    break
    return emails


def find_contacts(
    *,
    domain: str,
    titles: list[str] | None = None,
    limit: int = 5,
    verified: bool = False,
) -> dict[str, Any]:
    domain = (
        domain.strip()
        .lower()
        .removeprefix("https://")
        .removeprefix("http://")
        .split("/")[0]
    )
    if not domain or "." not in domain:
        return {"status": "failed", "error": "valid company domain required", "contacts": []}

    title_list = titles or DEFAULT_TITLES
    title_filters = [
        {
            "field": "experience.employment_details.current.title",
            "type": "(.)",
            "value": t,
        }
        for t in title_list
    ]
    filters: dict[str, Any] = {
        "op": "and",
        "conditions": [
            {
                "field": "experience.employment_details.current.company_website_domain",
                "type": "=",
                "value": domain,
            },
            {"op": "or", "conditions": title_filters},
        ],
    }

    ledger = CreditLedger()
    crust = CrustDataClient(ledger=ledger)
    contacts: list[dict[str, Any]] = []
    try:
        people = crust.person_search(filters, limit=limit)
        urls: list[str] = []
        meta: list[dict[str, Any]] = []
        for p in people:
            url = _profile_url(p)
            name, title = _name_title(p)
            row = {
                "name": name,
                "title": title,
                "profile_url": url,
                "emails": [],
            }
            meta.append(row)
            if url:
                urls.append(url)

        email_map: dict[str, list[str]] = {}
        if urls:
            enriched = crust.person_contact_enrich(urls[:25], verified=verified)
            email_map = _emails_from_contact_payload(enriched)

        for row in meta:
            url = row.get("profile_url") or ""
            # exact + suffix match (API may normalize URLs)
            emails = email_map.get(url) or []
            if not emails and url:
                for k, v in email_map.items():
                    if url.rstrip("/") in k or k.rstrip("/") in url:
                        emails = v
                        break
            row["emails"] = emails
            contacts.append(row)

        status = "complete"
        if not contacts:
            status = "empty"
        return {
            "status": status,
            "domain": domain,
            "contacts": contacts,
            "credits_spent": ledger.total,
        }
    except Exception as e:  # noqa: BLE001
        return {
            "status": "failed",
            "domain": domain,
            "error": str(e),
            "contacts": contacts,
            "credits_spent": ledger.total,
        }
    finally:
        crust.close()
