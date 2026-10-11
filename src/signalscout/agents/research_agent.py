"""Research Agent — qualify or archive signals; attach decision-maker context."""

from __future__ import annotations

from signalscout.config import SegmentConfig
from signalscout.graph import GraphStore
from signalscout.tracing import llm_complete


class ResearchAgent:
    def __init__(self, graph: GraphStore, cfg: SegmentConfig):
        self.graph = graph
        self.cfg = cfg

    def run(self) -> list[str]:
        qualified: list[str] = []
        processed = 0
        budget = max(0, int(self.cfg.max_signals_per_cycle))
        for sig in self.graph.unfinished_signals():
            if budget and processed >= budget:
                break
            if sig["state"] != "detected":
                continue
            processed += 1
            severity = int(sig.get("severity") or 0)
            implication = llm_complete(
                system=(
                    "You are a B2B GTM researcher. In 1-2 sentences, state the business "
                    "implication of this trigger for outbound sales. Use only provided facts."
                ),
                user=f"Company: {sig.get('company_name')} ({sig.get('domain')})\nSignal: {sig.get('summary')}",
                metadata={
                    "agent": "research",
                    "company": sig.get("company_name"),
                    "signal_id": sig["id"],
                    "summary": sig.get("summary"),
                },
            )
            # bump slightly if implication produced
            if implication:
                severity = min(100, severity + 5)
            if severity < self.cfg.archive_below_severity:
                self.graph.set_signal_state(sig["id"], "archived", severity)
            else:
                # store implication on summary append
                self.graph.set_signal_state(sig["id"], "qualified", severity)
                qualified.append(sig["id"])
                # keep implication in summary via Cypher-less append using set through create path
                # update summary
                with self.graph._driver.session() as session:
                    session.run(
                        """
                        MATCH (s:Signal {id: $id})
                        SET s.summary = coalesce(s.summary, '') + ' | Why it matters: ' + $imp
                        """,
                        id=sig["id"],
                        imp=implication[:280],
                    )
        return qualified
