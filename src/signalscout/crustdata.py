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
        out.write_text(json.dumps({"total": self.total, "entries": self.entries}, indent=2), encoding="utf-8")


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
        if not self.api_key and not isinstance(self._client._transport, httpx.MockTransport):
            # allow mock transport without key
            pass

        delay = 1.0
        last_err: Exception | None = None
        for attempt in range(max_retries):
            try:
                resp = self._client.request(method, path, json=body)
                credits = float(resp.headers.get("X-Credits-Used") or "0")
                req_id = resp.headers.get("X-Request-Id") or ""
                self.ledger.log(path, credits, req_id, resp.status_code)
                if resp.status_code in (429, 500, 502, 503, 504):
                    time.sleep(delay)
                    delay = min(delay * 2, 30)
                    continue
                resp.raise_for_status()
                return resp.json()
            except Exception as e:  # noqa: BLE001
                last_err = e
                time.sleep(delay)
                delay = min(delay * 2, 30)
        raise RuntimeError(f"CrustData failed after retries: {last_err}")

    def company_search(
        self,
        filters: list[dict[str, Any]],
        *,
        limit: int = 25,
        query: str | None = None,
    ) -> list[dict[str, Any]]:
        body: dict[str, Any] = {"filters": filters, "limit": limit}
        if query:
            body["query"] = query
        data = self._request("POST", "/company/search", body)
        if isinstance(data, list):
            return data
        return data.get("companies") or data.get("results") or data.get("data") or []

    def company_enrich(self, domains: list[str] | None = None, names: list[str] | None = None) -> Any:
        body: dict[str, Any] = {"fields": ["basic_info"]}
        if domains:
            body["domains"] = domains
        elif names:
            body["names"] = names
        else:
            raise ValueError("domains or names required")
        return self._request("POST", "/company/enrich", body)

    def person_enrich(self, profile_urls: list[str]) -> Any:
        return self._request(
            "POST",
            "/person/enrich",
            {
                "professional_network_profile_urls": profile_urls,
                "fields": ["basic_profile", "experience"],
            },
        )
