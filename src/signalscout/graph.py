"""Neo4j graph layer — idempotent MERGE, crash-resume via :Run / :Signal."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from neo4j import GraphDatabase

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "graph" / "schema.cypher"


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def payload_hash(payload: Any) -> str:
    raw = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


class GraphStore:
    def __init__(self, uri: str, user: str, password: str):
        self._driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self) -> None:
        self._driver.close()

    def verify(self) -> None:
        self._driver.verify_connectivity()

    def bootstrap_schema(self) -> None:
        if not SCHEMA_PATH.is_file():
            return
        chunks = SCHEMA_PATH.read_text(encoding="utf-8").split(";")
        with self._driver.session() as session:
            for chunk in chunks:
                lines = [
                    ln
                    for ln in chunk.splitlines()
                    if ln.strip() and not ln.strip().startswith("//")
                ]
                cypher = "\n".join(lines).strip()
                if cypher:
                    session.run(cypher)

    def upsert_segment(self, segment_id: str, dsl_text: str) -> None:
        with self._driver.session() as session:
            session.run(
                """
                MERGE (s:Segment {id: $id})
                ON CREATE SET s.dsl_text = $dsl, s.created_at = $now
                ON MATCH SET s.dsl_text = $dsl
                """,
                id=segment_id,
                dsl=dsl_text,
                now=_utc(),
            )

    def start_run(self, run_id: str | None = None) -> str:
        rid = run_id or f"run-{uuid.uuid4().hex[:12]}"
        with self._driver.session() as session:
            session.run(
                """
                MERGE (r:Run {id: $id})
                SET r.started_at = $now, r.status = 'running', r.credits_spent = 0
                """,
                id=rid,
                now=_utc(),
            )
        return rid

    def finish_run(self, run_id: str, status: str, credits: float) -> None:
        with self._driver.session() as session:
            session.run(
                """
                MATCH (r:Run {id: $id})
                SET r.finished_at = $now, r.status = $status, r.credits_spent = $credits
                """,
                id=run_id,
                now=_utc(),
                status=status,
                credits=float(credits),
            )

    def merge_company(self, company: dict[str, Any], segment_id: str) -> str:
        cid = str(company["crustdata_id"])
        with self._driver.session() as session:
            session.run(
                """
                MERGE (c:Company {crustdata_id: $cid})
                ON CREATE SET c.first_seen_at = $now
                SET c.name = $name, c.domain = $domain, c.industry = $industry,
                    c.headcount = $headcount, c.funding_stage = $funding_stage,
                    c.country = $country, c.last_snapshot_at = $now
                WITH c
                MATCH (s:Segment {id: $seg})
                MERGE (s)-[:WATCHES]->(c)
                """,
                cid=cid,
                name=company.get("name"),
                domain=company.get("domain"),
                industry=company.get("industry"),
                headcount=company.get("headcount"),
                funding_stage=company.get("funding_stage"),
                country=company.get("country"),
                now=_utc(),
                seg=segment_id,
            )
        return cid

    def merge_evidence(self, s3_key: str, source: str, payload: Any) -> str:
        ph = payload_hash(payload)
        with self._driver.session() as session:
            session.run(
                """
                MERGE (e:Evidence {payload_hash: $ph})
                ON CREATE SET e.s3_key = $key, e.source = $source, e.fetched_at = $now
                """,
                ph=ph,
                key=s3_key,
                source=source,
                now=_utc(),
            )
        return ph

    def signal_exists(self, signal_id: str) -> bool:
        with self._driver.session() as session:
            result = session.run(
                "MATCH (s:Signal {id: $id}) RETURN count(s) AS n", id=signal_id
            )
            row = result.single()
            return bool(row and row["n"] > 0)

    def create_signal_if_new(
        self,
        *,
        signal_id: str,
        signal_type: str,
        severity: int,
        summary: str,
        company_id: str,
        evidence_hash: str,
        run_id: str,
        state: str = "detected",
    ) -> bool:
        if self.signal_exists(signal_id):
            return False
        with self._driver.session() as session:
            session.run(
                """
                MATCH (c:Company {crustdata_id: $cid})
                MATCH (e:Evidence {payload_hash: $eh})
                MATCH (r:Run {id: $rid})
                CREATE (s:Signal {
                  id: $id, type: $type, severity: $sev,
                  detected_at: $now, state: $state, summary: $summary
                })
                CREATE (s)-[:TRIGGERED_BY {diff_summary: $summary}]->(c)
                CREATE (s)-[:EVIDENCED_BY]->(e)
                CREATE (r)-[:DETECTED]->(s)
                """,
                id=signal_id,
                cid=company_id,
                eh=evidence_hash,
                rid=run_id,
                type=signal_type,
                sev=severity,
                now=_utc(),
                state=state,
                summary=summary,
            )
        return True

    def set_signal_state(self, signal_id: str, state: str, severity: int | None = None) -> None:
        with self._driver.session() as session:
            if severity is None:
                session.run(
                    "MATCH (s:Signal {id: $id}) SET s.state = $state",
                    id=signal_id,
                    state=state,
                )
            else:
                session.run(
                    "MATCH (s:Signal {id: $id}) SET s.state = $state, s.severity = $sev",
                    id=signal_id,
                    state=state,
                    sev=severity,
                )

    def unfinished_signals(self) -> list[dict[str, Any]]:
        with self._driver.session() as session:
            result = session.run(
                """
                MATCH (s:Signal)
                WHERE s.state IN ['detected', 'qualified']
                OPTIONAL MATCH (s)-[:TRIGGERED_BY]->(c:Company)
                RETURN s.id AS id, s.type AS type, s.severity AS severity,
                       s.state AS state, s.summary AS summary, c.crustdata_id AS company_id,
                       c.name AS company_name, c.domain AS domain
                ORDER BY s.detected_at
                """
            )
            return [dict(r) for r in result]

    def create_draft(
        self,
        *,
        draft_id: str,
        body: str,
        confidence: int,
        signal_id: str,
        evidence_hashes: list[str],
    ) -> None:
        with self._driver.session() as session:
            session.run(
                """
                MATCH (s:Signal {id: $sid})
                MERGE (d:Draft {id: $id})
                SET d.body = $body, d.word_count = $wc, d.confidence = $conf, d.created_at = $now
                MERGE (d)-[:DRAFTED_FOR]->(s)
                """,
                id=draft_id,
                sid=signal_id,
                body=body,
                wc=len(body.split()),
                conf=confidence,
                now=_utc(),
            )
            for eh in evidence_hashes:
                session.run(
                    """
                    MATCH (d:Draft {id: $id})
                    MATCH (e:Evidence {payload_hash: $eh})
                    MERGE (d)-[:CITES]->(e)
                    """,
                    id=draft_id,
                    eh=eh,
                )
            session.run(
                "MATCH (s:Signal {id: $sid}) SET s.state = 'drafted'",
                sid=signal_id,
            )

    def draft_cites_ok(self, draft_id: str) -> bool:
        with self._driver.session() as session:
            result = session.run(
                """
                MATCH (d:Draft {id: $id})
                OPTIONAL MATCH (d)-[:CITES]->(e:Evidence)
                RETURN count(e) AS n
                """,
                id=draft_id,
            )
            row = result.single()
            return bool(row and row["n"] > 0)

    def days_signals(self, since_iso: str) -> list[dict[str, Any]]:
        with self._driver.session() as session:
            result = session.run(
                """
                MATCH (s:Signal)-[:TRIGGERED_BY]->(c:Company)
                WHERE s.detected_at >= $since AND s.state <> 'archived'
                OPTIONAL MATCH (d:Draft)-[:DRAFTED_FOR]->(s)
                RETURN s{.*} AS signal, c{.*} AS company, d{.*} AS draft
                ORDER BY s.severity DESC
                """,
                since=since_iso,
            )
            return [dict(r) for r in result]

    def company_snapshot(self, company_id: str) -> dict[str, Any] | None:
        with self._driver.session() as session:
            result = session.run(
                "MATCH (c:Company {crustdata_id: $id}) RETURN c{.*} AS c",
                id=company_id,
            )
            row = result.single()
            return row["c"] if row else None

    def count_signals(self) -> int:
        with self._driver.session() as session:
            row = session.run("MATCH (s:Signal) RETURN count(s) AS n").single()
            return int(row["n"]) if row else 0
