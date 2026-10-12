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
        except BaseException:
            # Ctrl+C during flush/shutdown should not dump OTEL stacks
            pass


def log_hitl_action(
    *,
    action: str,
    draft_id: str | None = None,
    signal_id: str | None = None,
    company: str | None = None,
    domain: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Record Approve/Edit/Reject as a neatlogs eval signal (Slack HITL analogue)."""
    payload = {
        "kind": "hitl_draft_action",
        "action": action,
        "draft_id": draft_id,
        "signal_id": signal_id,
        "company": company,
        "domain": domain,
        **(extra or {}),
    }
    nl = _active_nl.get()
    if nl is None:
        api_key = get_secret("NEATLOGS_API_KEY")
        if not api_key:
            return {"logged": False, "reason": "no_neatlogs_key", **payload}
        try:
            with neatlogs_session(workflow="signal-scout-hitl") as session_nl:
                if session_nl is None:
                    return {"logged": False, "reason": "init_failed", **payload}
                return _emit_hitl(session_nl, payload)
        except BaseException:
            return {"logged": False, "reason": "emit_failed", **payload}
    return _emit_hitl(nl, payload)


def _emit_hitl(nl: Any, payload: dict[str, Any]) -> dict[str, Any]:
    try:

        @nl.span(kind="AGENT", name="hitl_draft_action")
        def _traced() -> dict[str, Any]:
            # Attach payload on the span via return metadata when supported
            return payload

        _traced()
        return {"logged": True, **payload}
    except BaseException:
        return {"logged": False, "reason": "span_failed", **payload}


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
        company = str(meta.get("company") or "there")
        summary = str(meta.get("summary") or user[:160]).strip()
        # Strip vendor meta so stubs stay inbox-safe / company-native
        for noise in (
            "live company profile from CrustData",
            "from CrustData",
            "CrustData",
        ):
            summary = summary.replace(noise, "").strip(" :;|-")
        hook = summary[:140] if summary else f"what {company} is building"
        if meta.get("agent") == "research":
            return (
                f"{company}'s focus on {hook} is a timely hook for a short, "
                f"relevant outbound note — lead with their work, not your tool."
            )
        return (
            f"Subject: Quick note on {company}\n\n"
            f"Hi — noticed {hook}. "
            f"Curious if a short chat next week would be useful; happy to share how peers approached something similar."
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
