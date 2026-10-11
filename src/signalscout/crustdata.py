"""CrustData HTTP client with per-request credit logging."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

from signalscout.secrets import get_secret

API = "https://api.crustdata.com"
API_VERSION = "2025-11-01"


@dataclass
class CreditLedger:
    entries: list[dict[str, Any]] = field(default_factory=list)

    @property
    def total(self) -> float:
        return sum(float(e.get("credits") or 0) for e in self.entries)

    def log(self, path: str, credits: float, request_id: str = "", status: int = 200) -> None:
        self.entries.append(
            {
                "path": path,
                "credits": credits,
                "request_id": request_id,
                "status": status,
                "at": time.time(),
            }
        )

    def write(self, out: Path) -> None:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(
            json.dumps({"total": self.total, "entries": self.entries}, indent=2),
            encoding="utf-8",
        )


class CrustDataClient:
    def __init__(
        self,
        api_key: str | None = None,
        ledger: CreditLedger | None = None,
        transport: httpx.BaseTransport | None = None,
    ):
        self.api_key = api_key or get_secret("CRUSTDATA_API_KEY")
        self.ledger = ledger or CreditLedger()
        self._client = httpx.Client(
            base_url=API,
            headers={
                "Authorization": f"Bearer {self.api_key}" if self.api_key else "",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "x-api-version": API_VERSION,
            },
            timeout=90.0,
            transport=transport,
        )

    def close(self) -> None:
        self._client.close()

    def _request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        *,
        max_retries: int = 5,
    ) -> Any:
        delay = 1.0
        last_err: Exception | None = None
        for _attempt in range(max_retries):
            try:
                resp = self._client.request(method, path, json=body)
                credits = float(resp.headers.get("X-Credits-Used") or "0")
                req_id = resp.headers.get("X-Request-Id") or ""
                self.ledger.log(path, credits, req_id, resp.status_code)
                if resp.status_code in (429, 500, 502, 503, 504):
                    time.sleep(delay)
                    delay = min(delay * 2, 30)
                    continue
                if resp.status_code >= 400:
                    detail = resp.text[:800]
                    raise RuntimeError(
                        f"CrustData HTTP {resp.status_code} {path}: {detail}"
                    )
                return resp.json()
            except RuntimeError:
                raise
            except Exception as e:  # noqa: BLE001
                last_err = e
                time.sleep(delay)
                delay = min(delay * 2, 30)
        raise RuntimeError(f"CrustData failed after retries: {last_err}")

    def company_search(
        self,
        filters: list[dict[str, Any]] | dict[str, Any],
        *,
        limit: int = 25,
        search: dict[str, Any] | None = None,
        fields: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        if isinstance(filters, list):
            if len(filters) == 1:
                filt: dict[str, Any] = filters[0]
            else:
                filt = {"op": "and", "conditions": filters}
        else:
            filt = filters

        body: dict[str, Any] = {
            "filters": filt,
            "limit": limit,
            "fields": fields
            or [
                "basic_info.name",
                "basic_info.primary_domain",
                "funding",
                "headcount.total",
                "headcount.growth_percent",
                "locations.country",
            ],
        }
        # Ranked NL search — do not combine with sorts
        if search and search.get("query"):
            body["search"] = {
                "query": search["query"],
                "mode": search.get("mode") or "hybrid",
            }
        else:
            body["sorts"] = [
                {"field": "funding.last_fundraise_date", "order": "desc"}
            ]

        data = self._request("POST", "/company/search", body)
        if isinstance(data, list):
            return data
        for key in ("companies", "results", "data", "items"):
            if isinstance(data.get(key), list):
                return data[key]
        # some responses wrap under companies.results
        companies = data.get("companies")
        if isinstance(companies, dict) and isinstance(companies.get("results"), list):
            return companies["results"]
        return []

    def company_enrich(
        self, domains: list[str] | None = None, names: list[str] | None = None
    ) -> Any:
        body: dict[str, Any] = {
            "fields": [
                "basic_info",
                "funding",
                "headcount",
                "locations",
                "taxonomy",
            ]
        }
        if domains:
            body["domains"] = domains
        elif names:
            body["names"] = names
        else:
            raise ValueError("domains or names required")
        return self._request("POST", "/company/enrich", body)

    def person_enrich(
        self,
        profile_urls: list[str],
        *,
        fields: list[str] | None = None,
    ) -> Any:
        return self._request(
            "POST",
            "/person/enrich",
            {
                "professional_network_profile_urls": profile_urls,
                "fields": fields
                or ["basic_profile", "experience"],
            },
        )

    def person_search(
        self,
        filters: dict[str, Any],
        *,
        limit: int = 5,
        fields: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        body: dict[str, Any] = {
            "filters": filters,
            "limit": limit,
            "fields": fields
            or [
                "basic_profile.name",
                "basic_profile.current_title",
                "social_handles.professional_network_identifier.profile_url",
            ],
        }
        data = self._request("POST", "/person/search", body)
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        for key in ("people", "results", "data", "items", "profiles"):
            val = data.get(key) if isinstance(data, dict) else None
            if isinstance(val, list):
                return [x for x in val if isinstance(x, dict)]
        return []

    def person_contact_enrich(
        self,
        profile_urls: list[str],
        *,
        verified: bool = False,
    ) -> Any:
        return self._request(
            "POST",
            "/person/contact/enrich",
            {
                "professional_network_profile_urls": profile_urls,
                "fields": ["contact.business_emails"],
                "verified": verified,
            },
        )
