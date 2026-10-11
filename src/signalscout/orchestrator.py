"""One cycle: Signal → Research → Draft → (optional) Watchlist. Crash-safe via graph."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from signalscout.agents import DraftAgent, ResearchAgent, SignalAgent, WatchlistAgent
from signalscout.config import SegmentConfig, load_segment
from signalscout.crustdata import CreditLedger, CrustDataClient
from signalscout.evidence_store import EvidenceStore
from signalscout.graph import GraphStore
from signalscout.secrets import get_secret
from signalscout.tracing import neatlogs_session


def connect_graph():
    uri = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
    if uri in {"memory", "mem", "test"}:
        from signalscout.graph_memory import MemoryGraphStore

        return MemoryGraphStore()
    user = os.environ.get("NEO4J_USER", "neo4j")
    password = get_secret("NEO4J_PASSWORD", default="signalscout")
    g = GraphStore(uri, user, password)
    g.verify()
    g.bootstrap_schema()
    return g


def run_cycle(
    config_path: str | Path = "segment.yaml",
    *,
    dry_run: bool = False,
    companies_override: list[dict[str, Any]] | None = None,
    write_digest: bool = True,
) -> dict[str, Any]:
    cfg = load_segment(config_path)
    segment_id = "seg-" + cfg.dsl_text[:40].replace(" ", "-").lower()
    graph = connect_graph()
    ledger = CreditLedger()
    crust = CrustDataClient(ledger=ledger)
    evidence = EvidenceStore()

    run_id = graph.start_run()
    graph.upsert_segment(segment_id, cfg.dsl_text)
    status = "complete"
    result: dict[str, Any] = {"run_id": run_id, "created_signals": [], "drafts": []}

    try:
        with neatlogs_session():
            if dry_run:
                # Replay last signals from graph — zero external API
                unfinished = graph.unfinished_signals()
                result["dry_run"] = True
                result["replayed"] = len(unfinished)
                ResearchAgent(graph, cfg).run()
                result["drafts"] = DraftAgent(graph).run()
            else:
                # Resume unfinished first
                ResearchAgent(graph, cfg).run()
                DraftAgent(graph).run()

                signal_agent = SignalAgent(
                    graph,
                    crust,
                    evidence,
                    cfg,
                    companies_override=companies_override,
                )
                created = signal_agent.run(run_id, segment_id)
                result["created_signals"] = created
                ResearchAgent(graph, cfg).run()
                result["drafts"] = DraftAgent(graph).run()

            if write_digest:
                path = WatchlistAgent(graph).run(credits_spent=ledger.total)
                result["digest"] = str(path)

            if ledger.total > cfg.credit_budget_per_cycle:
                status = "failed"
                result["error"] = "credit budget exceeded"
            ledger.write(Path("credits") / f"{run_id}.json")
    except Exception as e:  # noqa: BLE001
        status = "failed"
        result["error"] = str(e)
        raise
    finally:
        graph.finish_run(run_id, status, ledger.total)
        # cost-per-qualified-lead stub for cfo.ai
        Path("business").mkdir(exist_ok=True)
        Path("business/cost_per_qualified_lead.json").write_text(
            json.dumps(
                {
                    "run_id": run_id,
                    "credits_spent": ledger.total,
                    "qualified_or_drafted": len(result.get("drafts") or []),
                    "cost_per_qualified_lead_credits": (
                        ledger.total / max(len(result.get("drafts") or []), 1)
                    ),
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        crust.close()
        graph.close()

    result["status"] = status
    result["credits_spent"] = ledger.total
    return result

