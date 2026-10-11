"""Draft number guard must keep fact-grounded amounts."""

from signalscout.agents.draft_agent import DraftAgent


def test_keeps_million_paraphrase_of_funding():
    facts = "Gallatin AI raised $50,000,000 series_a (announced 2026-10-08)"
    body = "Gallatin raised $50 million Series A on October 8, 2026."
    out = DraftAgent._strip_unknown_numbers(body, facts)
    assert "[fact]" not in out
    assert "50" in out


def test_strips_ungrounded_metric():
    facts = "Co raised $3,000,000 series_a (announced 2026-10-06)"
    body = "They grew revenue 400% after raising $3 million."
    out = DraftAgent._strip_unknown_numbers(body, facts)
    assert "400" not in out or "[fact]" in out
    assert "$3" in out or "3" in out
