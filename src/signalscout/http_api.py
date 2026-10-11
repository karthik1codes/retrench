"""Minimal HTTP API for the Next.js product UI (run on EC2)."""

from __future__ import annotations

import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from signalscout.orchestrator import connect_graph
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

        _json(self, 404, {"error": "not found"})


def serve(host: str = "0.0.0.0", port: int = 8787) -> None:
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(json.dumps({"listening": f"http://{host}:{port}"}))
    httpd.serve_forever()
