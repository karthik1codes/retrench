"""Minimal HTTP API for the Next.js product UI (run on EC2)."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from signalscout.orchestrator import connect_graph
from signalscout.person_contacts import find_contacts
from signalscout.scout_one import scout_company


def _cors(handler: BaseHTTPRequestHandler) -> None:
    origin = os.environ.get("SCOUT_CORS_ORIGIN", "*")
    handler.send_header("Access-Control-Allow-Origin", origin)
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, X-Scout-Token")


def _auth_ok(handler: BaseHTTPRequestHandler) -> bool:
    expected = os.environ.get("SCOUT_API_TOKEN", "").strip()
    if not expected:
        return True
    got = handler.headers.get("X-Scout-Token", "")
    return got == expected


def _json(handler: BaseHTTPRequestHandler, code: int, payload: Any) -> None:
    body = json.dumps(payload, default=str).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    _cors(handler)
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def drafts_for_company(query: str) -> list[dict[str, Any]]:
    q = query.strip().lower()
    graph = connect_graph()
    try:
        with graph._driver.session() as session:
            result = session.run(
                """
                MATCH (c:Company)
                WHERE toLower(coalesce(c.domain, '')) CONTAINS $q
                   OR toLower(coalesce(c.name, '')) CONTAINS $q
                MATCH (s:Signal)-[:TRIGGERED_BY]->(c)
                WHERE s.state <> 'archived'
                OPTIONAL MATCH (d:Draft)-[:DRAFTED_FOR]->(s)
                RETURN c.name AS company, c.domain AS domain,
                       s.id AS signal_id, s.summary AS summary,
                       s.severity AS severity, s.state AS state,
                       d.id AS draft_id, d.body AS draft_body,
                       d.confidence AS confidence
                ORDER BY s.detected_at DESC
                LIMIT 20
                """,
                q=q,
            )
            return [dict(r) for r in result]
    finally:
        graph.close()


def overview_payload() -> dict[str, Any]:
    """Live dashboard stats + activity from Neo4j (no fixtures)."""
    graph = connect_graph()
    try:
        with graph._driver.session() as session:
            counts = session.run(
                """
                OPTIONAL MATCH (s:Signal) WHERE s.state <> 'archived'
                WITH count(s) AS signals
                OPTIONAL MATCH (d:Draft)
                WITH signals, count(d) AS drafts
                OPTIONAL MATCH (c:Company)
                RETURN signals, drafts, count(c) AS companies
                """
            ).single()
            last_run = session.run(
                """
                MATCH (r:Run)
                RETURN r.id AS id, r.status AS status, r.credits_spent AS credits,
                       r.started_at AS started_at, r.finished_at AS finished_at
                ORDER BY coalesce(r.finished_at, r.started_at) DESC
                LIMIT 1
                """
            ).single()
            activity_rows = session.run(
                """
                MATCH (s:Signal)
                WHERE s.state <> 'archived' AND s.detected_at IS NOT NULL
                WITH substring(toString(s.detected_at), 0, 10) AS day, count(*) AS signals
                RETURN day, signals
                ORDER BY day ASC
                """
            )
            draft_days = session.run(
                """
                MATCH (d:Draft)
                WHERE d.created_at IS NOT NULL
                WITH substring(toString(d.created_at), 0, 10) AS day, count(*) AS drafts
                RETURN day, drafts
                ORDER BY day ASC
                """
            )
            signal_rows = session.run(
                """
                MATCH (s:Signal)-[:TRIGGERED_BY]->(c:Company)
                WHERE s.state <> 'archived'
                OPTIONAL MATCH (d:Draft)-[:DRAFTED_FOR]->(s)
                RETURN s.id AS id,
                       coalesce(s.type, 'signal') AS type,
                       coalesce(s.summary, '') AS summary,
                       coalesce(s.severity, 0) AS severity,
                       coalesce(s.state, '') AS state,
                       s.detected_at AS detected_at,
                       coalesce(c.name, 'Unknown') AS company,
                       coalesce(c.domain, '') AS domain,
                       d.id AS draft_id,
                       d.confidence AS confidence,
                       d.body AS draft_body
                ORDER BY s.detected_at DESC
                LIMIT 100
                """
            )

            by_day: dict[str, dict[str, int]] = {}
            for row in activity_rows:
                day = str(row["day"] or "")[:10]
                if not day:
                    continue
                by_day.setdefault(day, {"date": day, "signals": 0, "drafts": 0})
                by_day[day]["signals"] = int(row["signals"] or 0)
            for row in draft_days:
                day = str(row["day"] or "")[:10]
                if not day:
                    continue
                by_day.setdefault(day, {"date": day, "signals": 0, "drafts": 0})
                by_day[day]["drafts"] = int(row["drafts"] or 0)
            activity = [by_day[k] for k in sorted(by_day.keys())]

            signals = []
            for r in signal_rows:
                signals.append(
                    {
                        "id": r["id"],
                        "type": r["type"],
                        "summary": r["summary"],
                        "severity": int(r["severity"] or 0),
                        "state": r["state"],
                        "detected_at": r["detected_at"],
                        "company": r["company"],
                        "domain": r["domain"],
                        "draft_id": r["draft_id"],
                        "confidence": r["confidence"],
                        "has_draft": bool(r["draft_id"]),
                    }
                )

            return {
                "status": "complete",
                "stats": {
                    "signals": int(counts["signals"] or 0) if counts else 0,
                    "drafts_ready": int(counts["drafts"] or 0) if counts else 0,
                    "companies": int(counts["companies"] or 0) if counts else 0,
                    "last_run_id": last_run["id"] if last_run else None,
                    "last_run_status": last_run["status"] if last_run else None,
                    "last_run_credits": float(last_run["credits"] or 0)
                    if last_run
                    else 0.0,
                    "last_run_at": (last_run["finished_at"] or last_run["started_at"])
                    if last_run
                    else None,
                },
                "activity": activity,
                "signals": signals,
            }
    finally:
        graph.close()


def watchlist_payload(*, days: int = 14) -> dict[str, Any]:
    graph = connect_graph()
    try:
        with graph._driver.session() as session:
            result = session.run(
                """
                MATCH (s:Signal)-[:TRIGGERED_BY]->(c:Company)
                WHERE s.state <> 'archived'
                OPTIONAL MATCH (d:Draft)-[:DRAFTED_FOR]->(s)
                RETURN s.id AS id,
                       coalesce(s.severity, 0) AS severity,
                       coalesce(c.name, 'Unknown') AS company,
                       coalesce(c.domain, '') AS domain,
                       coalesce(s.summary, '') AS summary,
                       coalesce(s.state, '') AS state,
                       d.body AS draft_body,
                       d.confidence AS confidence
                ORDER BY s.severity DESC, s.detected_at DESC
                LIMIT 50
                """
            )
            signals = []
            for r in result:
                draft = None
                body = r["draft_body"]
                if body:
                    subject = "Outreach"
                    text = str(body)
                    if text.lower().startswith("subject:"):
                        lines = text.split("\n", 1)
                        subject = lines[0][8:].strip()
                        text = lines[1].lstrip("\n") if len(lines) > 1 else ""
                    draft = {
                        "subject": subject,
                        "body": text,
                        "confidence": int(r["confidence"] or 0),
                    }
                signals.append(
                    {
                        "id": r["id"],
                        "severity": int(r["severity"] or 0),
                        "company": r["company"],
                        "domain": r["domain"],
                        "summary": r["summary"],
                        "why": r["summary"],
                        "draft": draft,
                    }
                )
            return {
                "status": "complete",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "signals": signals,
                "days": days,
            }
    finally:
        graph.close()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        return

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        _cors(self)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path in {"/health", "/"}:
            _json(self, 200, {"ok": True, "service": "signalscout"})
            return
        if not _auth_ok(self):
            _json(self, 401, {"error": "unauthorized"})
            return
        if parsed.path == "/drafts":
            qs = parse_qs(parsed.query)
            company = (qs.get("company") or qs.get("q") or [""])[0]
            if not company:
                _json(self, 400, {"error": "company query required"})
                return
            try:
                rows = drafts_for_company(company)
                _json(self, 200, {"company": company, "items": rows})
            except Exception as e:  # noqa: BLE001
                _json(self, 500, {"error": str(e)})
            return
        if parsed.path == "/overview":
            try:
                _json(self, 200, overview_payload())
            except Exception as e:  # noqa: BLE001
                _json(self, 500, {"error": str(e), "status": "failed"})
            return
        if parsed.path == "/watchlist":
            try:
                _json(self, 200, watchlist_payload())
            except Exception as e:  # noqa: BLE001
                _json(self, 500, {"error": str(e), "status": "failed"})
            return
        _json(self, 404, {"error": "not found"})

    def do_POST(self) -> None:
        if not _auth_ok(self):
            _json(self, 401, {"error": "unauthorized"})
            return
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            _json(self, 400, {"error": "invalid json"})
            return

        if parsed.path == "/scout":
            domain = (body.get("domain") or "").strip() or None
            name = (body.get("name") or body.get("company") or "").strip() or None
            if domain and not re.match(r"^[\w.-]+\.[a-zA-Z]{2,}$", domain.split("/")[0]):
                # allow bare domains; if looks like a name, shift
                if " " in domain or "." not in domain:
                    name = name or domain
                    domain = None
            try:
                result = scout_company(
                    config_path=body.get("config") or "segment.yaml",
                    domain=domain,
                    name=name,
                )
                code = 200 if result.get("status") == "complete" else 422
                _json(self, code, result)
            except Exception as e:  # noqa: BLE001
                _json(self, 500, {"error": str(e)})
            return

        if parsed.path == "/contacts":
            domain = (body.get("domain") or "").strip()
            if not domain and body.get("company"):
                domain = str(body.get("company")).strip()
            titles = body.get("titles")
            if titles is not None and not isinstance(titles, list):
                titles = None
            try:
                result = find_contacts(
                    domain=domain,
                    titles=titles,
                    limit=int(body.get("limit") or 5),
                    verified=bool(body.get("verified") or False),
                )
                code = 200 if result.get("status") in {"complete", "empty"} else 422
                _json(self, code, result)
            except Exception as e:  # noqa: BLE001
                _json(self, 500, {"error": str(e)})
            return

        _json(self, 404, {"error": "not found"})


def serve(host: str = "0.0.0.0", port: int = 8787) -> None:
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(json.dumps({"listening": f"http://{host}:{port}"}))
    httpd.serve_forever()
