"""Signal Agent: mocked funding detected exactly once on re-run."""

from __future__ import annotations

import os

import pytest

os.environ["NEO4J_URI"] = "memory"

from signalscout.agents.signal_agent import SignalAgent
from signalscout.config import load_segment
from signalscout.crustdata import CreditLedger, CrustDataClient
from signalscout.evidence_store import EvidenceStore
from signalscout.graph_memory import MemoryGraphStore


MOCK_PAYFLOW = {
    "crustdata_id": "cd-payflow",
    "name": "PayFlow",
    "domain": "payflow.example",
    "industry": "Fintech",
    "headcount": 80,
    "funding_stage": "Series A",
    "last_funding_date": "2026-10-09",
    "last_funding_amount": "$18M",
    "country": "United States",
    "is_new_funding": True,
}


@pytest.fixture
def cfg(tmp_path):
    # use repo segment.yaml
    return load_segment("segment.yaml")


def test_funding_signal_once_on_rerun(cfg, tmp_path):
    graph = MemoryGraphStore()
    graph.upsert_segment("seg-test", cfg.dsl_text)
    crust = CrustDataClient(api_key="test", ledger=CreditLedger())
    evidence = EvidenceStore(local_root=tmp_path / "ev")

    agent = SignalAgent(
        graph, crust, evidence, cfg, companies_override=[MOCK_PAYFLOW]
    )
    run1 = graph.start_run("run-1")
    created1 = agent.run(run1, "seg-test")
    assert len(created1) == 1
    assert graph.count_signals() == 1

    run2 = graph.start_run("run-2")
    created2 = agent.run(run2, "seg-test")
    assert created2 == []
    assert graph.count_signals() == 1
