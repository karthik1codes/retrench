"""Draft Agent — ~90-word cold email; every draft CITES Evidence."""

from __future__ import annotations

import re
import uuid

from signalscout.config import SegmentConfig
from signalscout.graph import GraphStore
from signalscout.tracing import llm_complete


class DraftAgent:
    def __init__(self, graph: GraphStore, cfg: SegmentConfig | None = None):
        self.graph = graph
        self.cfg = cfg

    def run(self) -> list[str]:
        drafted: list[str] = []
        budget = max(0, int(self.cfg.max_signals_per_cycle)) if self.cfg else 0
        for sig in self.graph.unfinished_signals():
            if budget and len(drafted) >= budget:
                break
            if sig["state"] != "qualified":
                continue
            evidence_hashes = self._evidence_for(sig["id"])
            if not evidence_hashes:
                continue

            facts = sig.get("summary") or ""
            body = llm_complete(
                system=(
                    "Write a cold email under 90 words. ONLY use facts from the user message. "
                    "No invented metrics, names, or funding amounts. Draft only — do not send."
                ),
                user=(
                    f"Company: {sig.get('company_name')}\n"
                    f"Domain: {sig.get('domain')}\n"
                    f"Allowed facts: {facts}\n"
                    f"Evidence ids: {', '.join(evidence_hashes[:3])}"
                ),
                metadata={
                    "agent": "draft",
                    "company": sig.get("company_name"),
                    "signal_id": sig["id"],
                    "summary": facts,
                },
            )
            body = self._clamp_words(body, 90)
            # Strip any claim-looking numbers not present in facts (light guard)
            body = self._strip_unknown_numbers(body, facts)

            draft_id = f"draft-{uuid.uuid4().hex[:10]}"
            confidence = 88 if evidence_hashes else 40
            self.graph.create_draft(
                draft_id=draft_id,
                body=body,
                confidence=confidence,
                signal_id=sig["id"],
                evidence_hashes=evidence_hashes,
            )
            if not self.graph.draft_cites_ok(draft_id):
                raise RuntimeError(f"Hallucination guard failed for {draft_id}")
            drafted.append(draft_id)
        return drafted

    def _evidence_for(self, signal_id: str) -> list[str]:
        with self.graph._driver.session() as session:
            result = session.run(
                """
                MATCH (s:Signal {id: $id})-[:EVIDENCED_BY]->(e:Evidence)
                RETURN e.payload_hash AS h
                """,
                id=signal_id,
            )
            return [r["h"] for r in result if r["h"]]

    @staticmethod
    def _clamp_words(text: str, n: int) -> str:
        words = text.split()
        if len(words) <= n:
            return text.strip()
        return " ".join(words[:n]).strip()

    @staticmethod
    def _strip_unknown_numbers(body: str, facts: str) -> str:
        allowed = set(re.findall(r"\d[\d,\.]*", facts))
        def repl(m: re.Match[str]) -> str:
            tok = m.group(0)
            return tok if tok in allowed else "[fact]"
        # only replace dollar-like or large numbers not in facts
        return re.sub(r"\$?\d[\d,\.]*%?", repl, body)
