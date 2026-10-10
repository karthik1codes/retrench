"""
Retrench autonomous control agent (long-running).

Loop: Watch neatlogs cliffs → Investigate → Decide keep/fix/kill → Act
(fix brief / pause) → Watchdog verify.

Calls the Retrench API on localhost or EC2:
  POST {RETRENCH_BASE_URL}/api/agent/tick

Env:
  RETRENCH_BASE_URL   default http://127.0.0.1:3000
  AGENT_TICK_SECONDS  default 60 (use 900 on EC2 with Lambda, or 60 for demos)
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    here = Path(__file__).resolve()
    for candidate in (
        here.parents[2] / ".env.local",
        here.parents[2] / "web" / ".env.local",
    ):
        if candidate.is_file():
            load_dotenv(candidate, override=False)


def tick(base: str) -> dict:
    url = f"{base.rstrip('/')}/api/agent/tick"
    req = urllib.request.Request(url, method="POST", data=b"")
    req.add_header("Accept", "application/json")
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.loads(res.read().decode("utf-8"))


def main() -> int:
    _load_dotenv()
    base = os.environ.get("RETRENCH_BASE_URL", "http://127.0.0.1:3000")
    interval = int(os.environ.get("AGENT_TICK_SECONDS", "60"))
    once = os.environ.get("AGENT_ONCE", "").lower() in {"1", "true", "yes"}

    print(f"Retrench control agent → {base}/api/agent/tick every {interval}s")
    print("Watch → Investigate → Decide → Act → Watchdog")

    while True:
        try:
            result = tick(base)
            summary = (result.get("tick") or {}).get("summary") or "ok"
            print(f"[{time.strftime('%H:%M:%S')}] {summary}")
        except urllib.error.URLError as e:
            print(f"[{time.strftime('%H:%M:%S')}] API unreachable: {e}", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print(f"[{time.strftime('%H:%M:%S')}] tick error: {e}", file=sys.stderr)

        if once:
            return 0
        time.sleep(interval)


if __name__ == "__main__":
    raise SystemExit(main())
