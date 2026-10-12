"""Parallel-safe user profile merges."""

from __future__ import annotations

import os

os.environ["NEO4J_URI"] = "memory"

from signalscout.user_profile import empty_profile, merge_profiles, upsert_profile


def test_merge_sent_drafts_by_id():
    base = empty_profile("u1", email="a@b.com")
    base["sentDrafts"] = [
        {
            "id": "s1",
            "company": "Acme",
            "sentAt": "2026-01-01T00:00:00Z",
            "followUps": [{"id": "f1", "status": "pending"}],
        }
    ]
    patch = {
        "userId": "u1",
        "sentDrafts": [
            {
                "id": "s1",
                "company": "Acme",
                "sentAt": "2026-01-02T00:00:00Z",
                "followUps": [{"id": "f1", "status": "sent"}],
            },
            {
                "id": "s2",
                "company": "Beta",
                "sentAt": "2026-01-03T00:00:00Z",
                "followUps": [],
            },
        ],
    }
    merged = merge_profiles(base, patch)
    ids = {d["id"] for d in merged["sentDrafts"]}
    assert ids == {"s1", "s2"}
    s1 = next(d for d in merged["sentDrafts"] if d["id"] == "s1")
    assert s1["followUps"][0]["status"] == "sent"
    assert merged["version"] == 1


def test_upsert_memory_roundtrip():
    p1 = upsert_profile(
        "user@example.com",
        {
            "outreachPrefs": {
                "sendMode": "agent",
                "verifySent": True,
                "askedAt": "2026-01-01T00:00:00Z",
            },
            "sentDrafts": [
                {
                    "id": "d1",
                    "company": "X",
                    "domain": "x.com",
                    "to": "a@x.com",
                    "subject": "Hi",
                    "body": "Body",
                    "channel": "gmail",
                    "sentAt": "2026-01-01T00:00:00Z",
                    "followUps": [],
                }
            ],
        },
        email="user@example.com",
        device={"id": "laptop"},
    )
    assert p1["version"] >= 1
    assert p1["outreachPrefs"]["sendMode"] == "agent"
    assert any(d["id"] == "laptop" for d in p1["devices"])

    p2 = upsert_profile(
        "user@example.com",
        {
            "sentDrafts": [
                {
                    "id": "d2",
                    "company": "Y",
                    "domain": "y.com",
                    "to": "b@y.com",
                    "subject": "Yo",
                    "body": "Body2",
                    "channel": "mailto",
                    "sentAt": "2026-01-02T00:00:00Z",
                    "followUps": [],
                }
            ],
        },
        device={"id": "phone"},
    )
    ids = {d["id"] for d in p2["sentDrafts"]}
    assert "d1" in ids and "d2" in ids
    device_ids = {d["id"] for d in p2["devices"]}
    assert "laptop" in device_ids and "phone" in device_ids
