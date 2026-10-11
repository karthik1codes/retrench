"""neatlogs tracing helpers for LLM calls."""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Iterator

from signalscout.secrets import get_secret


@contextmanager
def neatlogs_session(workflow: str = "signal-scout") -> Iterator[Any]:
    api_key = get_secret("NEATLOGS_API_KEY")
    if not api_key:
        yield None
        return
    import neatlogs

    neatlogs.init(
        api_key=api_key,
        endpoint=os.environ.get("NEATLOGS_INGEST_ENDPOINT", "https://ingest.neatlogs.com"),
        workflow_name=workflow,
    )
    try:
        yield neatlogs
    finally:
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
        # deterministic stub for tests / dry environments
        return (
            f"[stub draft] Reaching out about {meta.get('company', 'your company')}: "
            f"{meta.get('summary', user[:120])}. Happy to share how peers handled this."
        )

    with neatlogs_session() as nl:
        from openrouter import OpenRouter

        client = nl.wrap(OpenRouter(api_key=openrouter_key)) if nl else OpenRouter(api_key=openrouter_key)

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

        if nl:
            span = nl.span(kind="LLM", name=meta.get("agent", "llm"))
            with span:
                # attach metadata if supported
                try:
                    span.set_attributes(meta)  # type: ignore[attr-defined]
                except Exception:
                    pass
                return _call()
        return _call()
