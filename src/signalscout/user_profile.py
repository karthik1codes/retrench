"""Per-user profile store — prefs, sent drafts, style memory.

Durable in Neo4j (:User). MemoryGraph keeps an in-process dict for tests.
Parallel PUTs merge by entity id (last-write-wins on field timestamps / version).
"""

from __future__ import annotations

import json
import threading
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from signalscout.orchestrator import connect_graph

_lock = threading.RLock()
_memory_users: dict[str, dict[str, Any]] = {}


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def empty_profile(user_id: str, *, email: str = "", name: str = "") -> dict[str, Any]:
    return {
        "userId": user_id,
        "email": email,
        "name": name,
        "version": 0,
        "updatedAt": _utc(),
        "outreachPrefs": {
            "sendMode": "hitl",
            "verifySent": True,
            "askedAt": None,
        },
        "sentDrafts": [],
        "styleMemory": [],
        "devices": [],
    }


def _index_by_id(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for row in rows or []:
        rid = str(row.get("id") or "").strip()
        if rid:
            out[rid] = row
    return out


def _newer(a: dict[str, Any], b: dict[str, Any], *keys: str) -> dict[str, Any]:
    def stamp(row: dict[str, Any]) -> str:
        for k in keys:
            v = row.get(k)
            if v:
                return str(v)
        return ""

    return a if stamp(a) >= stamp(b) else b


def merge_profiles(
    base: dict[str, Any],
    patch: dict[str, Any],
    *,
    device: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """CRDT-ish merge safe for parallel device writes."""
    out = deepcopy(base) if base else empty_profile(
        str(patch.get("userId") or "unknown"),
        email=str(patch.get("email") or ""),
        name=str(patch.get("name") or ""),
    )
    if patch.get("email"):
        out["email"] = patch["email"]
    if patch.get("name"):
        out["name"] = patch["name"]

    prefs_a = out.get("outreachPrefs") or {}
    prefs_b = patch.get("outreachPrefs") or {}
    if prefs_b:
        asked_a = str(prefs_a.get("askedAt") or "")
        asked_b = str(prefs_b.get("askedAt") or "")
        out["outreachPrefs"] = prefs_b if asked_b >= asked_a else prefs_a
        # still take explicit fields from newer prefs
        if asked_b >= asked_a:
            out["outreachPrefs"] = {**prefs_a, **prefs_b}

    drafts = _index_by_id(list(out.get("sentDrafts") or []))
    for row in patch.get("sentDrafts") or []:
        rid = str(row.get("id") or "").strip()
        if not rid:
            continue
        if rid in drafts:
            drafts[rid] = _newer(drafts[rid], row, "sentAt", "updatedAt")
            # merge follow-ups by id
            fus = _index_by_id(list(drafts[rid].get("followUps") or []))
            for fu in row.get("followUps") or []:
                fid = str(fu.get("id") or "").strip()
                if not fid:
                    continue
                if fid in fus:
                    # status progression: sent/skipped wins over pending
                    cur = fus[fid]
                    if fu.get("status") in {"sent", "skipped"} and cur.get("status") == "pending":
                        fus[fid] = {**cur, **fu}
                    elif cur.get("status") in {"sent", "skipped"}:
                        fus[fid] = cur
                    else:
                        fus[fid] = {**cur, **fu}
                else:
                    fus[fid] = fu
            drafts[rid]["followUps"] = list(fus.values())
        else:
            drafts[rid] = row
    out["sentDrafts"] = sorted(
        drafts.values(),
        key=lambda d: str(d.get("sentAt") or ""),
        reverse=True,
    )[:200]

    mem = _index_by_id(list(out.get("styleMemory") or []))
    for row in patch.get("styleMemory") or []:
        rid = str(row.get("id") or "").strip()
        if not rid:
            continue
        if rid in mem:
            mem[rid] = _newer(mem[rid], row, "at")
        else:
            mem[rid] = row
    out["styleMemory"] = sorted(
        mem.values(),
        key=lambda m: str(m.get("at") or ""),
        reverse=True,
    )[:40]

    devices = _index_by_id(
        [
            {**d, "id": str(d.get("id") or d.get("deviceId") or "")}
            for d in (out.get("devices") or [])
        ]
    )
    for d in patch.get("devices") or []:
        did = str(d.get("id") or d.get("deviceId") or "").strip()
        if not did:
            continue
        devices[did] = {**(devices.get(did) or {}), **d, "id": did}
    if device:
        did = str(device.get("id") or device.get("deviceId") or "").strip()
        if did:
            devices[did] = {
                **(devices.get(did) or {}),
                **device,
                "id": did,
                "lastSeenAt": _utc(),
            }
    out["devices"] = list(devices.values())[:20]

    out["version"] = int(out.get("version") or 0) + 1
    out["updatedAt"] = _utc()
    return out


def _load_neo4j(graph: Any, user_id: str) -> dict[str, Any] | None:
    with graph._driver.session() as session:
        row = session.run(
            """
            MATCH (u:User {id: $id})
            RETURN u.payload AS payload, u.version AS version,
                   u.email AS email, u.name AS name, u.updated_at AS updated_at
            """,
            id=user_id,
        ).single()
    if not row or not row.get("payload"):
        return None
    try:
        data = json.loads(row["payload"])
    except (TypeError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    data["userId"] = user_id
    data["version"] = int(row.get("version") or data.get("version") or 0)
    if row.get("email"):
        data["email"] = row["email"]
    if row.get("name"):
        data["name"] = row["name"]
    if row.get("updated_at"):
        data["updatedAt"] = row["updated_at"]
    return data


def _save_neo4j(graph: Any, profile: dict[str, Any]) -> None:
    uid = str(profile["userId"])
    with graph._driver.session() as session:
        session.run(
            """
            MERGE (u:User {id: $id})
            SET u.email = $email,
                u.name = $name,
                u.version = $version,
                u.updated_at = $updated,
                u.payload = $payload
            """,
            id=uid,
            email=profile.get("email") or "",
            name=profile.get("name") or "",
            version=int(profile.get("version") or 0),
            updated=profile.get("updatedAt") or _utc(),
            payload=json.dumps(profile, default=str),
        )


def _is_neo4j(graph: Any) -> bool:
    return type(graph).__name__ == "GraphStore" and hasattr(graph, "_driver")


def get_profile(user_id: str) -> dict[str, Any]:
    uid = str(user_id).strip()
    if not uid:
        raise ValueError("user_id required")
    with _lock:
        if uid in _memory_users and not _is_neo4j_env():
            return deepcopy(_memory_users[uid])
        graph = connect_graph()
        try:
            if _is_neo4j(graph):
                found = _load_neo4j(graph, uid)
                if found:
                    return found
            elif uid in _memory_users:
                return deepcopy(_memory_users[uid])
        finally:
            graph.close()
        return empty_profile(uid)


def _is_neo4j_env() -> bool:
    import os

    uri = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
    return uri not in {"memory", "mem", "test"}


def upsert_profile(
    user_id: str,
    patch: dict[str, Any],
    *,
    email: str = "",
    name: str = "",
    device: dict[str, Any] | None = None,
    base_version: int | None = None,
) -> dict[str, Any]:
    """Merge patch into stored profile. Parallel-safe under process lock + merge."""
    uid = str(user_id).strip()
    if not uid:
        raise ValueError("user_id required")
    with _lock:
        graph = connect_graph()
        try:
            if _is_neo4j(graph):
                current = _load_neo4j(graph, uid) or empty_profile(
                    uid, email=email, name=name
                )
            else:
                current = deepcopy(
                    _memory_users.get(uid)
                    or empty_profile(uid, email=email, name=name)
                )

            if email and not patch.get("email"):
                patch = {**patch, "email": email}
            if name and not patch.get("name"):
                patch = {**patch, "name": name}
            patch = {**patch, "userId": uid}

            # base_version mismatch still merges (eventual consistency)
            _ = base_version
            merged = merge_profiles(current, patch, device=device)

            if _is_neo4j(graph):
                _save_neo4j(graph, merged)
            else:
                _memory_users[uid] = deepcopy(merged)
            return merged
        finally:
            graph.close()
