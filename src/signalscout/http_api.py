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


def drafts_for_company(
    query: str,
    *,
    month: str | None = "recent",
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Return signals/drafts for a company.

    ``month``:
      - ``\"recent\"`` (default): last 30 days
      - ``\"current\"``: calendar month in UTC
      - ``YYYY-MM``: that month
      - ``None`` / ``\"all\"``: no time filter
    """
    q = query.strip().lower()
    if not q or q in {"none", "null", "undefined"}:
        return []
    month_prefix, since_iso = _month_window(month)
    graph = connect_graph()
    try:
        with graph._driver.session() as session:
            result = session.run(
                """
                MATCH (c:Company)
                WHERE toLower(coalesce(c.domain, '')) = $q
                   OR toLower(coalesce(c.domain, '')) CONTAINS $q
                   OR toLower(coalesce(c.name, '')) CONTAINS $q
                MATCH (s:Signal)-[:TRIGGERED_BY]->(c)
                WHERE s.state <> 'archived'
                  AND (
                    ($month_prefix IS NULL AND $since_iso IS NULL)
                    OR ($month_prefix IS NOT NULL AND substring(toString(coalesce(s.detected_at, '')), 0, 7) = $month_prefix)
                    OR ($since_iso IS NOT NULL AND toString(coalesce(s.detected_at, '')) >= $since_iso)
                  )
                OPTIONAL MATCH (d:Draft)-[:DRAFTED_FOR]->(s)
                OPTIONAL MATCH (d)-[:CITES]->(e:Evidence)
                RETURN c.name AS company, c.domain AS domain,
                       coalesce(c.industry, '') AS industry,
                       s.id AS signal_id,
                       coalesce(s.type, 'signal') AS type,
                       s.summary AS summary,
                       s.implication AS implication,
                       s.severity AS severity, s.state AS state,
                       s.detected_at AS detected_at,
                       coalesce(s.suppression_reason, '') AS suppression_reason,
                       d.id AS draft_id, d.body AS draft_body,
                       d.confidence AS confidence,
                       collect(DISTINCT e.payload_hash) AS evidence_hashes
                ORDER BY s.detected_at DESC
                LIMIT $limit
                """,
                q=q,
                month_prefix=month_prefix,
                since_iso=since_iso,
                limit=limit,
            )
            rows = []
            for r in result:
                row = dict(r)
                hashes = [h for h in (row.get("evidence_hashes") or []) if h]
                row["evidence_hashes"] = hashes
                rows.append(row)
            # Prefer exact domain matches first
            exact = [
                r
                for r in rows
                if str(r.get("domain") or "").lower() == q
                or str(r.get("company") or "").lower() == q
            ]
            return exact or rows
    finally:
        graph.close()


def _month_window(month: str | None) -> tuple[str | None, str | None]:
    """Return (month_prefix, since_iso) — only one should be set."""
    if month is None or month in {"", "all", "*"}:
        return None, None
    if month == "recent":
        since = datetime.now(timezone.utc).timestamp() - (30 * 86400)
        return None, datetime.fromtimestamp(since, tz=timezone.utc).isoformat()
    if month == "current":
        return datetime.now(timezone.utc).strftime("%Y-%m"), None
    if re.fullmatch(r"\d{4}-\d{2}", month):
        return month, None
    since = datetime.now(timezone.utc).timestamp() - (30 * 86400)
    return None, datetime.fromtimestamp(since, tz=timezone.utc).isoformat()


def targets_payload(*, days: int = 7, limit: int = 200) -> dict[str, Any]:
    """Companies with drafts in the last ``days`` days, grouped by industry."""
    days = max(1, min(int(days or 7), 90))
    since = datetime.now(timezone.utc).timestamp() - (days * 86400)
    since_iso = datetime.fromtimestamp(since, tz=timezone.utc).isoformat()

    graph = connect_graph()
    try:
        with graph._driver.session() as session:
            last_run = session.run(
                """
                MATCH (r:Run)
                RETURN r.finished_at AS finished_at, r.started_at AS started_at,
                       r.status AS status, r.id AS id
                ORDER BY coalesce(r.finished_at, r.started_at) DESC
                LIMIT 1
                """
            ).single()
            # Prefer companies that got a Draft this week (rolling window).
            rows = session.run(
                """
                MATCH (d:Draft)-[:DRAFTED_FOR]->(s:Signal)-[:TRIGGERED_BY]->(c:Company)
                WHERE d.created_at IS NOT NULL
                  AND toString(d.created_at) >= $since
                  AND (s.state IS NULL OR s.state <> 'archived')
                WITH c,
                     count(DISTINCT d) AS draft_count,
                     count(DISTINCT s) AS signal_count,
                     max(d.created_at) AS last_draft_at,
                     max(s.detected_at) AS last_signal_at
                RETURN coalesce(c.name, 'Unknown') AS name,
                       coalesce(c.domain, '') AS domain,
                       coalesce(nullif(trim(coalesce(c.industry, '')), ''), 'Uncategorized') AS industry,
                       c.headcount AS headcount,
                       c.funding_stage AS funding_stage,
                       c.last_funding_date AS last_funding_date,
                       c.last_funding_amount AS last_funding_amount,
                       c.headcount_growth_30d_pct AS headcount_growth_30d_pct,
                       c.country AS country,
                       draft_count,
                       signal_count,
                       last_draft_at,
                       last_signal_at,
                       coalesce(c.updated_at, c.last_snapshot_at) AS updated_at
                ORDER BY last_draft_at DESC, name ASC
                LIMIT $limit
                """,
                since=since_iso,
                limit=limit,
            )
            companies: list[dict[str, Any]] = []
            for r in rows:
                growth = r["headcount_growth_30d_pct"]
                if isinstance(growth, (int, float)):
                    growth = round(float(growth), 1)
                companies.append(
                    {
                        "name": r["name"],
                        "domain": r["domain"],
                        "industry": r["industry"] or "Uncategorized",
                        "headcount": r["headcount"],
                        "funding_stage": r["funding_stage"],
                        "last_funding_date": r["last_funding_date"],
                        "last_funding_amount": r["last_funding_amount"],
                        "headcount_growth_30d_pct": growth,
                        "country": r["country"],
                        "draft_count": int(r["draft_count"] or 0),
                        "signal_count": int(r["signal_count"] or 0),
                        "last_draft_at": r["last_draft_at"],
                        "last_signal_at": r["last_signal_at"],
                        "updated_at": r["updated_at"],
                    }
                )

            by_industry: dict[str, list[dict[str, Any]]] = {}
            for c in companies:
                by_industry.setdefault(c["industry"], []).append(c)

            categories = [
                {
                    "industry": industry,
                    "count": len(rows_in),
                    "companies": rows_in,
                }
                for industry, rows_in in sorted(
                    by_industry.items(),
                    key=lambda item: (-len(item[1]), item[0].lower()),
                )
            ]

            return {
                "status": "complete",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "refresh_interval_hours": 1,
                "window_days": days,
                "window_since": since_iso,
                "source": "weekly_drafts",
                "total": len(companies),
                "last_run_id": last_run["id"] if last_run else None,
                "last_run_status": last_run["status"] if last_run else None,
                "last_run_at": (
                    (last_run["finished_at"] or last_run["started_at"])
                    if last_run
                    else None
                ),
                "categories": categories,
                "companies": companies,
            }
    finally:
        graph.close()


def overview_payload() -> dict[str, Any]:
    """Live dashboard stats + current-month activity/signals from Neo4j."""
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    graph = connect_graph()
    try:
        with graph._driver.session() as session:
            counts = session.run(
                """
                OPTIONAL MATCH (s:Signal)
                WHERE s.state <> 'archived'
                  AND substring(toString(coalesce(s.detected_at, '')), 0, 7) = $month
                WITH count(s) AS signals
                OPTIONAL MATCH (d:Draft)
                WHERE substring(toString(coalesce(d.created_at, '')), 0, 7) = $month
                WITH signals, count(d) AS drafts
                OPTIONAL MATCH (c:Company)
                RETURN signals, drafts, count(c) AS companies
                """,
                month=month,
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
                  AND substring(toString(s.detected_at), 0, 7) = $month
                WITH substring(toString(s.detected_at), 0, 10) AS day, count(*) AS signals
                RETURN day, signals
                ORDER BY day ASC
                """,
                month=month,
            )
            draft_days = session.run(
                """
                MATCH (d:Draft)
                WHERE d.created_at IS NOT NULL
                  AND substring(toString(d.created_at), 0, 7) = $month
                WITH substring(toString(d.created_at), 0, 10) AS day, count(*) AS drafts
                RETURN day, drafts
                ORDER BY day ASC
                """,
                month=month,
            )
            signal_rows = session.run(
                """
                MATCH (s:Signal)-[:TRIGGERED_BY]->(c:Company)
                WHERE s.state <> 'archived'
                  AND substring(toString(coalesce(s.detected_at, '')), 0, 7) = $month
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
                """,
                month=month,
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
                "month": month,
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
    days = max(1, min(int(days or 14), 90))
    since_ts = datetime.now(timezone.utc).timestamp() - (days * 86400)
    since_iso = datetime.fromtimestamp(since_ts, tz=timezone.utc).isoformat()
    graph = connect_graph()
    try:
        with graph._driver.session() as session:
            result = session.run(
                """
                MATCH (s:Signal)-[:TRIGGERED_BY]->(c:Company)
                WHERE s.state <> 'archived'
                  AND (
                    s.detected_at IS NULL
                    OR toString(s.detected_at) >= $since
                  )
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
                """,
                since=since_iso,
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
        if parsed.path == "/targets":
            try:
                qs = parse_qs(parsed.query)
                days_raw = (qs.get("days") or ["7"])[0]
                try:
                    days = int(days_raw)
                except ValueError:
                    days = 7
                _json(self, 200, targets_payload(days=days))
            except Exception as e:  # noqa: BLE001
                _json(self, 500, {"error": str(e), "status": "failed"})
            return
        if parsed.path == "/watchlist":
            try:
                qs = parse_qs(parsed.query)
                days_raw = (qs.get("days") or ["14"])[0]
                try:
                    days = int(days_raw)
                except ValueError:
                    days = 14
                _json(self, 200, watchlist_payload(days=days))
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

        if parsed.path == "/draft-action":
            action = str(body.get("action") or "").strip().lower()
            if action not in {"approve", "edit", "reject"}:
                _json(
                    self,
                    400,
                    {"error": "action must be approve|edit|reject"},
                )
                return
            try:
                from signalscout.tracing import log_hitl_action

                logged = log_hitl_action(
                    action=action,
                    draft_id=(body.get("draft_id") or None),
                    signal_id=(body.get("signal_id") or None),
                    company=(body.get("company") or None),
                    domain=(body.get("domain") or None),
                    extra={
                        "subject": body.get("subject"),
                        "word_count": len(str(body.get("body") or "").split())
                        if body.get("body")
                        else None,
                    },
                )
                _json(
                    self,
                    200,
                    {
                        "status": "ok",
                        "action": action,
                        "logged": logged.get("logged"),
                        "detail": logged,
                    },
                )
            except Exception as e:  # noqa: BLE001
                _json(self, 500, {"error": str(e)})
            return

        _json(self, 404, {"error": "not found"})


def serve(host: str = "0.0.0.0", port: int = 8787) -> None:
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(json.dumps({"listening": f"http://{host}:{port}"}))
    httpd.serve_forever()
