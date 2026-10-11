"""neatlogs tracing helpers for LLM calls."""

from __future__ import annotations

import os
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Iterator

from signalscout.secrets import get_secret

_active_nl: ContextVar[Any] = ContextVar("neatlogs_sdk", default=None)


@contextmanager
def neatlogs_session(workflow: str = "signal-scout") -> Iterator[Any]:
    """One init/flush/shutdown for an entire cycle (not per LLM call)."""
    api_key = get_secret("NEATLOGS_API_KEY")
    if not api_key:
        token = _active_nl.set(None)
        try:
            yield None
        finally:
            _active_nl.reset(token)
        return

    import neatlogs

    neatlogs.init(
        api_key=api_key,
        endpoint=os.environ.get(
            "NEATLOGS_INGEST_ENDPOINT", "https://ingest.neatlogs.com"
        ),
        workflow_name=workflow,
    )
    token = _active_nl.set(neatlogs)
    try:
        yield neatlogs
    finally:
        _active_nl.reset(token)
        try:
            neatlogs.flush()
            neatlogs.shutdown()
        except Exception:
            pass


def llm_complete(
    *,
    system: str,
    user: str,
    metadata: dict[str, Any] | None = None,
    model: str | None = None,
) -> str:
    """Traced LLM call; falls back to deterministic stub without keys."""
    openrouter_key = get_secret("OPENROUTER_API_KEY")
    model = model or os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")
    meta = metadata or {}

    if not openrouter_key:
        return (
            f"[stub draft] Reaching out about {meta.get('company', 'your company')}: "
            f"{meta.get('summary', user[:120])}. Happy to share how peers handled this."
        )

    from openrouter import OpenRouter

    nl = _active_nl.get()
    client = (
        nl.wrap(OpenRouter(api_key=openrouter_key))
        if nl
        else OpenRouter(api_key=openrouter_key)
    )
    agent_name = str(meta.get("agent", "llm"))

    def _call() -> str:
        resp = client.chat.send(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.2,
            max_tokens=220,
        )
        return resp.choices[0].message.content or ""

    # neatlogs.span is a decorator, not a context manager
    if nl:
        @nl.span(kind="AGENT", name=agent_name)
        def _traced() -> str:
            return _call()

        return _traced()
    return _call()
