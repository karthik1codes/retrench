"""Hallucination eval: drafts must CITES evidence."""

from __future__ import annotations

import os

os.environ["NEO4J_URI"] = "memory"
os.environ.pop("OPENROUTER_API_KEY", None)

from signalscout.agents.draft_agent import DraftAgent
from signalscout.agents.research_agent import ResearchAgent
from signalscout.agents.signal_agent import SignalAgent
from signalscout.config import load_segment
from signalscout.crustdata import CreditLedger, CrustDataClient
from signalscout.evidence_store import EvidenceStore
from signalscout.graph_memory import MemoryGraphStore


def test_twenty_drafts_all_cite_evidence(tmp_path):
    cfg = load_segment("segment.yaml")
    # Citation fixture seeds 20 companies; lift the 5/cycle Research/Draft cap.
    cfg = cfg.model_copy(update={"max_signals_per_cycle": 50})
    graph = MemoryGraphStore()
    graph.upsert_segment("seg-test", cfg.dsl_text)
    crust = CrustDataClient(api_key="test", ledger=CreditLedger())
    evidence = EvidenceStore(local_root=tmp_path / "ev")

    companies = []
    for i in range(20):
        companies.append(
            {
                "crustdata_id": f"cd-{i}",
                "name": f"Co{i}",
                "domain": f"co{i}.example",
                "funding_stage": "Series A",
                "last_funding_date": "2026-10-09",
                "last_funding_amount": f"${i+1}M",
                "is_new_funding": True,
                "headcount": 50 + i,
            }
        )

    run_id = graph.start_run()
    SignalAgent(graph, crust, evidence, cfg, companies_override=companies).run(
        run_id, "seg-test"
    )
    ResearchAgent(graph, cfg).run()
    drafts = DraftAgent(graph).run()
    assert len(drafts) == 20
    for did in drafts:
        assert graph.draft_cites_ok(did)
