"""Watchlist Agent — nightly markdown + JSON digest from the graph."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from signalscout.graph import GraphStore


class WatchlistAgent:
    def __init__(self, graph: GraphStore, out_dir: str | Path = "credits/digests"):
        self.graph = graph
        self.out_dir = Path(out_dir)
        self.out_dir.mkdir(parents=True, exist_ok=True)

    def run(self, credits_spent: float = 0.0) -> Path:
        since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        rows = self.graph.days_signals(since)
        day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        md_path = self.out_dir / f"digest-{day}.md"
        json_path = self.out_dir / f"digest-{day}.json"

        lines = [
            f"# Signal Scout Digest – {day}",
            "",
            f"Today: {len(rows)} signals · {credits_spent} CrustData credits",
            "",
        ]
        archived = 0
        for row in rows:
            s = row["signal"]
            c = row["company"]
            d = row.get("draft")
            sev = s.get("severity", 0)
            if s.get("state") == "archived":
                archived += 1
                continue
            fire = "🔥 " if sev >= 85 else ""
            lines.append(f"## {fire}{sev} – {s.get('summary')}")
            lines.append(f"Company: {c.get('name')} ({c.get('domain')})")
            if d:
                lines.append(f"→ Draft ready (confidence {d.get('confidence')})")
                lines.append("")
                lines.append(d.get("body") or "")
            lines.append("")

        if archived:
            lines.append(f"## Archived ({archived}): below threshold — kept in graph, not shown")

        md_path.write_text("\n".join(lines), encoding="utf-8")
        json_path.write_text(
            json.dumps({"day": day, "credits_spent": credits_spent, "signals": rows}, indent=2, default=str),
            encoding="utf-8",
        )
        return md_path
