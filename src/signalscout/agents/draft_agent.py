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
        self.suppressions: list[dict[str, str]] = []

    def run(self, *, company_ids: set[str] | None = None) -> list[str]:
        drafted: list[str] = []
        self.suppressions = []
        budget = max(0, int(self.cfg.max_signals_per_cycle)) if self.cfg else 0
        for sig in self.graph.unfinished_signals():
            if company_ids is not None and sig.get("company_id") not in company_ids:
                continue
            if budget and len(drafted) >= budget:
                break
            if sig["state"] != "qualified":
                continue

            # Scheduled cycles only: do-not-contact (LangChain-style verification-first)
            cid = sig.get("company_id")
            if company_ids is None and cid:
                reason = self._suppress_reason(str(cid))
                if reason:
                    self.graph.set_signal_state(
                        sig["id"],
                        "suppressed",
                        suppression_reason=reason,
                    )
                    self.suppressions.append(
                        {
                            "signal_id": str(sig["id"]),
                            "company_id": str(cid),
                            "reason": reason,
                        }
                    )
                    continue

            evidence_hashes = self._evidence_for(sig["id"])
            if not evidence_hashes:
                continue

            facts = sig.get("summary") or ""
            body = llm_complete(
                system=(
                    "Write a cold outreach email that is likely to land in Inbox, not Spam. "
                    "HARD LIMITS: under 90 words; plaintext only; one short subject line then blank line then body. "
                    "Format exactly:\nSubject: <line>\n\n<body>\n"
                    "DELIVERABILITY: personal, specific, and calm — reference ONE real trigger from Allowed facts. "
                    "No hype, urgency, scarcity, 'guaranteed', 'act now', 'free', ALL CAPS, or emoji. "
                    "No links, tracking params, attachments mentions, or HTML. "
                    "No mail-merge placeholders like [Name], {Company}, or Dear Sir/Madam. "
                    "Open with the company or signal — not 'I hope this finds you well'. "
                    "One clear soft ask (15-min chat or reply) — never pitch a product dump. "
                    "Sound like a peer, not a sequencer. Avoid spammy patterns ($$$ , !!!, 'opportunity of a lifetime'). "
                    "NEVER mention CrustData, data vendors, enrichment, scrapers, or 'live company profile'. "
                    "NEVER use subjects like 'Explore … Profile' or 'Checking in on your company page'. "
                    "Subject must reference a concrete company fact (product, funding, hire, growth) — not the data source. "
                    "ONLY use facts from the user message. Copy funding amounts and dates exactly as written. "
                    "No invented metrics, names, titles, or amounts. Draft only — do not send."
                ),
                user=(
                    f"Company: {sig.get('company_name')}\n"
                    f"Domain: {sig.get('domain')}\n"
                    f"Signal type: {sig.get('type')}\n"
                    f"Allowed facts: {facts}\n"
                    f"Evidence ids: {', '.join(evidence_hashes[:3])}\n"
                    "Write Subject + body for a human SDR sending from their own mailbox. "
                    "If this is a profile/snapshot signal, hook on what the company sells or builds — not that a database has their page."
                ),
                metadata={
                    "agent": "draft",
                    "company": sig.get("company_name"),
                    "signal_id": sig["id"],
                    "summary": facts,
                },
            )
            body = self._clamp_words(body, 90)
            # Drop claim-looking numbers not grounded in facts (allow $Xm paraphrases)
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

    def _suppress_reason(self, company_id: str) -> str | None:
        if (
            hasattr(self.graph, "company_support_risk")
            and self.graph.company_support_risk(company_id)
        ):
            return "support_risk"
        if (
            hasattr(self.graph, "company_has_recent_draft")
            and self.graph.company_has_recent_draft(company_id, days=7)
        ):
            return "recent_touch"
        return None

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
    def _fact_numbers(facts: str) -> set[float]:
        """Numeric values grounded in facts, including $N → N million shorthand."""
        allowed: set[float] = set()
        for tok in re.findall(r"\d[\d,\.]*", facts):
            try:
                v = float(tok.replace(",", ""))
            except ValueError:
                continue
            allowed.add(v)
            if v >= 1_000_000:
                allowed.add(v / 1_000_000)
            if v >= 1_000_000_000:
                allowed.add(v / 1_000_000_000)
        for y, m, d in re.findall(r"(\d{4})-(\d{2})-(\d{2})", facts):
            allowed.update(
                {
                    float(y),
                    float(m),
                    float(d),
                    float(int(m)),
                    float(int(d)),
                }
            )
        return allowed

    @classmethod
    def _strip_unknown_numbers(cls, body: str, facts: str) -> str:
        allowed = cls._fact_numbers(facts)

        def grounded(v: float) -> bool:
            for a in allowed:
                if abs(v - a) < 1e-6:
                    return True
                # rounded percents / display forms (17.07 → 17)
                if a > 1 and abs(v - round(a, 1)) < 0.15:
                    return True
                if a > 1 and abs(v - round(a)) < 0.51:
                    return True
            return False

        def repl(m: re.Match[str]) -> str:
            raw = m.group(0)
            core = raw.lstrip("$").rstrip("%")
            try:
                v = float(core.replace(",", ""))
            except ValueError:
                return "[fact]"
            return raw if grounded(v) else "[fact]"

        return re.sub(r"\$?\d[\d,\.]*%?", repl, body)
