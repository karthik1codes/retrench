"""
Demo production agent for Retrench — Checkout Recovery.

Neatlogs-traced OpenRouter entry point (one-shot script).
Requires: pip install -U neatlogs openrouter
Env: NEATLOGS_API_KEY, OPENROUTER_API_KEY
Optional: NEATLOGS_INGEST_ENDPOINT, OPENROUTER_MODEL
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _load_dotenv_files() -> None:
    """Load gitignored .env.local from repo root / web if python-dotenv is available."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    here = Path(__file__).resolve()
    for candidate in (
        here.parents[2] / ".env.local",
        here.parents[2] / "web" / ".env.local",
        here.parent / ".env",
    ):
        if candidate.is_file():
            load_dotenv(candidate, override=False)


def main() -> int:
    _load_dotenv_files()

    api_key = os.environ.get("NEATLOGS_API_KEY") or os.environ.get(
        "NEATLOGS_PROJECT_API_KEY"
    )
    if not api_key:
        print("Set NEATLOGS_API_KEY (or NEATLOGS_PROJECT_API_KEY).", file=sys.stderr)
        return 1

    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    if not openrouter_key:
        print("Set OPENROUTER_API_KEY to run the instrumented agent.", file=sys.stderr)
        return 1

    import neatlogs
    from openrouter import OpenRouter

    neatlogs.init(
        api_key=api_key,
        endpoint=os.environ.get(
            "NEATLOGS_INGEST_ENDPOINT", "https://ingest.neatlogs.com"
        ),
        workflow_name="checkout-recovery",
    )
    client = neatlogs.wrap(OpenRouter(api_key=openrouter_key))
    model = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")

    @neatlogs.span(kind="WORKFLOW")
    def run_checkout_recovery(order_id: str, customer_note: str) -> str:
        """Checkout Recovery feature entry point Retrench tracks."""
        resp = client.chat.send(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are checkout_agent. Complete failed checkouts without "
                        "double-charging. Prefer bounded retries. Never invent charges."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Order {order_id}. Customer: {customer_note}",
                },
            ],
            temperature=0.3,
            max_tokens=512,
        )
        return resp.choices[0].message.content or ""

    try:
        print(
            run_checkout_recovery(
                "NL-10482",
                "Checkout keeps timing out. Do not charge Maya twice.",
            )
        )
    finally:
        neatlogs.flush()
        neatlogs.shutdown()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
