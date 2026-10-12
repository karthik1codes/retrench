"""Golden GTM evals — LangChain-style rule checks without live APIs."""

from __future__ import annotations

import os
import re

os.environ["NEO4J_URI"] = "memory"
os.environ.pop("OPENROUTER_API_KEY", None)

from signalscout.agents.draft_agent import DraftAgent
from signalscout.agents.research_agent import ResearchAgent
from signalscout.agents.signal_agent import SignalAgent
from signalscout.config import load_segment
from signalscout.crustdata import CreditLedger, CrustDataClient
from signalscout.evidence_store import EvidenceStore
from signalscout.graph_memory import MemoryGraphStore

SPAM_TOKENS = re.compile(
    r"\b(FREE|GUARANTEED|ACT NOW|LIMITED TIME|$$$|CLICK HERE)\b",
    re.I,
)


def _cfg():
    cfg = load_segment("segment.yaml")
    return cfg.model_copy(update={"max_signals_per_cycle": 20})


def _run_pipeline(graph, cfg, companies, *, tmp_path, run_id="run-1"):
    crust = CrustDataClient(api_key="test", ledger=CreditLedger())
    evidence = EvidenceStore(local_root=tmp_path / "ev")
    graph.upsert_segment("seg-test", cfg.dsl_text)
    rid = graph.start_run(run_id)
    created = SignalAgent(
        graph, crust, evidence, cfg, companies_override=companies
    ).run(rid, "seg-test")
    ResearchAgent(graph, cfg).run()
    draft_agent = DraftAgent(graph, cfg)
    drafts = draft_agent.run()
    return created, drafts, draft_agent


def _draft_bodies(graph, draft_ids):
    return [graph.drafts[d]["body"] for d in draft_ids if d in graph.drafts]


def _assert_inbox_heuristics(bodies: list[str]) -> None:
    for body in bodies:
        words = body.split()
        assert len(words) <= 95, f"draft too long: {len(words)}"
        assert not SPAM_TOKENS.search(body), f"spam token in: {body[:80]}"
        # No ALL-CAPS shouty subject-only lines beyond short tokens
        caps = [w for w in words if len(w) > 4 and w.isupper()]
        assert len(caps) <= 2, f"too much ALL CAPS: {caps}"


def test_golden_funding_cites(tmp_path):
    cfg = _cfg()
    graph = MemoryGraphStore()
    company = {
        "crustdata_id": "cd-fund",
        "name": "FundCo",
        "domain": "fundco.example",
        "funding_stage": "Series A",
        "last_funding_date": "2026-10-09",
        "last_funding_amount": "$12M",
        "is_new_funding": True,
        "headcount": 40,
    }
    created, drafts, _ = _run_pipeline(graph, cfg, [company], tmp_path=tmp_path)
    assert created, "funding signal should be created"
    assert any(graph.signals[s]["type"] == "funding" for s in created)
    assert drafts, "funding should produce a draft"
    assert all(graph.draft_cites_ok(d) for d in drafts)
    _assert_inbox_heuristics(_draft_bodies(graph, drafts))


def test_golden_headcount_surge(tmp_path):
    cfg = _cfg()
    graph = MemoryGraphStore()
    company = {
        "crustdata_id": "cd-surge",
        "name": "SurgeCo",
        "domain": "surgeco.example",
        "headcount": 90,
        "headcount_growth_30d_pct": 18.5,
    }
    created, drafts, _ = _run_pipeline(graph, cfg, [company], tmp_path=tmp_path)
    assert any(graph.signals[s]["type"] == "headcount_surge" for s in created)
    assert drafts
    assert all(graph.draft_cites_ok(d) for d in drafts)


def test_golden_exec_hire(tmp_path):
    cfg = _cfg()
    graph = MemoryGraphStore()
    company = {
        "crustdata_id": "cd-exec",
        "name": "ExecCo",
        "domain": "execco.example",
        "headcount": 55,
        "people": [
            {
                "name": "Jamie Lee",
                "title": "VP Sales",
                "tenure_start": "2026-09-15",
                "crustdata_id": "p-jamie",
            }
        ],
    }
    created, drafts, _ = _run_pipeline(graph, cfg, [company], tmp_path=tmp_path)
    assert any(graph.signals[s]["type"] == "exec_hire" for s in created)
    assert drafts
    assert all(graph.draft_cites_ok(d) for d in drafts)


def test_golden_duplicate_idempotent(tmp_path):
    cfg = _cfg()
    graph = MemoryGraphStore()
    company = {
        "crustdata_id": "cd-dup",
        "name": "DupCo",
        "domain": "dupco.example",
        "funding_stage": "Series B",
        "last_funding_date": "2026-10-01",
        "last_funding_amount": "$40M",
        "is_new_funding": True,
        "headcount": 100,
    }
    crust = CrustDataClient(api_key="test", ledger=CreditLedger())
    evidence = EvidenceStore(local_root=tmp_path / "ev")
    graph.upsert_segment("seg-test", cfg.dsl_text)
    agent = SignalAgent(
        graph, crust, evidence, cfg, companies_override=[company]
    )
    r1 = graph.start_run("run-a")
    c1 = agent.run(r1, "seg-test")
    assert len(c1) >= 1
    ResearchAgent(graph, cfg).run()
    d1 = DraftAgent(graph, cfg).run()
    assert d1

    r2 = graph.start_run("run-b")
    c2 = agent.run(r2, "seg-test")
    assert c2 == [], "same funding fingerprint must not recreate signal"
    # No new qualified backlog for the same signal after drafted
    unfinished = [s for s in graph.unfinished_signals() if s["state"] == "qualified"]
    assert unfinished == []


def test_golden_recent_touch_and_support_risk_suppress(tmp_path):
    cfg = _cfg()
    graph = MemoryGraphStore()
    company = {
        "crustdata_id": "cd-touch",
        "name": "TouchCo",
        "domain": "touchco.example",
        "funding_stage": "Series A",
        "last_funding_date": "2026-10-08",
        "last_funding_amount": "$8M",
        "is_new_funding": True,
        "headcount": 33,
    }
    created, drafts, agent = _run_pipeline(
        graph, cfg, [company], tmp_path=tmp_path, run_id="run-touch-1"
    )
    assert created and drafts

    # Second scheduled pass: re-qualify a duplicate-style signal path via support_risk
    # Simulate another qualified signal for same company after first draft
    sid = f"sig-extra-{created[0]}"
    eh = graph.merge_evidence("evidence/extra.json", "test", {"n": 1})
    graph.signals[sid] = {
        "id": sid,
        "type": "funding",
        "severity": 85,
        "summary": "TouchCo raised $8M Series A (announced 2026-10-08)",
        "detected_at": graph.signals[created[0]]["detected_at"],
        "state": "qualified",
        "company_id": "cd-touch",
    }
    graph.signal_evidence[sid] = [eh]

    agent2 = DraftAgent(graph, cfg)
    more = agent2.run()  # scheduled: company_ids=None → suppress recent_touch
    assert more == []
    assert agent2.suppressions
    assert agent2.suppressions[0]["reason"] == "recent_touch"
    assert graph.signals[sid]["state"] == "suppressed"
    assert graph.signals[sid].get("suppression_reason") == "recent_touch"

    # support_risk stub takes precedence
    graph.merge_company(
        {**company, "support_risk": True},
        "seg-test",
    )
    sid2 = "sig-risk-1"
    eh2 = graph.merge_evidence("evidence/risk.json", "test", {"n": 2})
    graph.signals[sid2] = {
        "id": sid2,
        "type": "funding",
        "severity": 85,
        "summary": "TouchCo raised $8M Series A (announced 2026-10-08)",
        "detected_at": graph.signals[created[0]]["detected_at"],
        "state": "qualified",
        "company_id": "cd-touch",
    }
    graph.signal_evidence[sid2] = [eh2]
    agent3 = DraftAgent(graph, cfg)
    assert agent3.run() == []
    assert agent3.suppressions[0]["reason"] == "support_risk"
