"""In-memory graph for unit tests / --dry environments without Neo4j."""

from __future__ import annotations

import copy
import uuid
from datetime import datetime, timezone
from typing import Any

from signalscout.graph import payload_hash


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


class MemoryGraphStore:
    def __init__(self) -> None:
        self.segments: dict[str, dict] = {}
        self.companies: dict[str, dict] = {}
        self.evidence: dict[str, dict] = {}
        self.signals: dict[str, dict] = {}
        self.drafts: dict[str, dict] = {}
        self.runs: dict[str, dict] = {}
        self.watches: set[tuple[str, str]] = set()
        self.signal_evidence: dict[str, list[str]] = {}
        self.draft_cites: dict[str, list[str]] = {}
        self.run_signals: dict[str, list[str]] = {}

    def close(self) -> None:
        return

    def verify(self) -> None:
        return

    def bootstrap_schema(self) -> None:
        return

    def upsert_segment(self, segment_id: str, dsl_text: str) -> None:
        self.segments[segment_id] = {
            "id": segment_id,
            "dsl_text": dsl_text,
            "created_at": _utc(),
        }

    def start_run(self, run_id: str | None = None) -> str:
        rid = run_id or f"run-{uuid.uuid4().hex[:12]}"
        self.runs[rid] = {
            "id": rid,
            "started_at": _utc(),
            "status": "running",
            "credits_spent": 0,
        }
        self.run_signals.setdefault(rid, [])
        return rid

    def finish_run(self, run_id: str, status: str, credits: float) -> None:
        self.runs[run_id].update(
            {"finished_at": _utc(), "status": status, "credits_spent": credits}
        )

    def merge_company(self, company: dict[str, Any], segment_id: str) -> str:
        cid = str(company["crustdata_id"])
        prev = self.companies.get(cid, {})
        row = {
            **prev,
            **{k: company.get(k) for k in (
                "name", "domain", "industry", "headcount",
                "funding_stage", "country",
            )},
            "crustdata_id": cid,
            "last_snapshot_at": _utc(),
            "first_seen_at": prev.get("first_seen_at") or _utc(),
            # keep funding date for diffs in tests
            "last_funding_date": company.get("last_funding_date") or prev.get("last_funding_date"),
        }
        self.companies[cid] = row
        self.watches.add((segment_id, cid))
        return cid

    def merge_evidence(self, s3_key: str, source: str, payload: Any) -> str:
        ph = payload_hash(payload)
        self.evidence.setdefault(
            ph,
            {"payload_hash": ph, "s3_key": s3_key, "source": source, "fetched_at": _utc()},
        )
        return ph

    def signal_exists(self, signal_id: str) -> bool:
        return signal_id in self.signals

    def create_signal_if_new(self, **kwargs: Any) -> bool:
        sid = kwargs["signal_id"]
        if sid in self.signals:
            return False
        self.signals[sid] = {
            "id": sid,
            "type": kwargs["signal_type"],
            "severity": kwargs["severity"],
            "summary": kwargs["summary"],
            "detected_at": _utc(),
            "state": kwargs.get("state", "detected"),
            "company_id": kwargs["company_id"],
        }
        self.signal_evidence[sid] = [kwargs["evidence_hash"]]
        self.run_signals.setdefault(kwargs["run_id"], []).append(sid)
        return True

    def set_signal_state(self, signal_id: str, state: str, severity: int | None = None) -> None:
        s = self.signals[signal_id]
        s["state"] = state
        if severity is not None:
            s["severity"] = severity

    def unfinished_signals(self) -> list[dict[str, Any]]:
        out = []
        for s in self.signals.values():
            if s["state"] not in ("detected", "qualified"):
                continue
            c = self.companies.get(s["company_id"], {})
            out.append(
                {
                    **s,
                    "company_name": c.get("name"),
                    "domain": c.get("domain"),
                }
            )
        return out

    def create_draft(self, **kwargs: Any) -> None:
        did = kwargs["draft_id"]
        self.drafts[did] = {
            "id": did,
            "body": kwargs["body"],
            "word_count": len(kwargs["body"].split()),
            "confidence": kwargs["confidence"],
            "created_at": _utc(),
            "signal_id": kwargs["signal_id"],
        }
        self.draft_cites[did] = list(kwargs["evidence_hashes"])
        self.signals[kwargs["signal_id"]]["state"] = "drafted"

    def draft_cites_ok(self, draft_id: str) -> bool:
        return len(self.draft_cites.get(draft_id, [])) > 0

    def days_signals(self, since_iso: str) -> list[dict[str, Any]]:
        out = []
        for s in self.signals.values():
            if s["state"] == "archived":
                continue
            if s["detected_at"] < since_iso:
                continue
            c = self.companies.get(s["company_id"], {})
            d = next((x for x in self.drafts.values() if x["signal_id"] == s["id"]), None)
            out.append({"signal": s, "company": c, "draft": d})
        return sorted(out, key=lambda r: -int(r["signal"].get("severity") or 0))

    def company_snapshot(self, company_id: str) -> dict[str, Any] | None:
        c = self.companies.get(company_id)
        return copy.deepcopy(c) if c else None

    def count_signals(self) -> int:
        return len(self.signals)

    # research agent writes via _driver — provide shim
    class _Sess:
        def __init__(self, store: "MemoryGraphStore"):
            self.store = store

        def __enter__(self) -> "MemoryGraphStore._Sess":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def run(self, cypher: str, **params: Any) -> Any:
            if "SET s.summary" in cypher:
                sid = params["id"]
                if sid in self.store.signals:
                    self.store.signals[sid]["summary"] = (
                        (self.store.signals[sid].get("summary") or "")
                        + " | Why it matters: "
                        + params["imp"]
                    )

            class R:
                def __iter__(self_inner):
                    return iter([])

            if "EVIDENCED_BY" in cypher and "RETURN e.payload_hash" in cypher:
                sid = params["id"]
                hashes = self.store.signal_evidence.get(sid, [])

                class Row(dict):
                    pass

                class Res:
                    def __iter__(self_inner):
                        return iter([{"h": h} for h in hashes])

                return Res()
            return R()

    class _Driver:
        def __init__(self, store: "MemoryGraphStore"):
            self.store = store

        def session(self) -> "MemoryGraphStore._Sess":
            return MemoryGraphStore._Sess(self.store)

    @property
    def _driver(self) -> _Driver:
        return MemoryGraphStore._Driver(self)
