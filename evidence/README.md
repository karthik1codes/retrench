# Evidence (neatHack judging)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

## Elevator pitch

This folder stores **proof artifacts** for neatHack judging: Entire checkpoint IDs, optional neatlogs screenshots, and sample digests from live EC2 runs. It is not application runtime code.

## Key features

- **`checkpoints.json`** — Entire checkpoint IDs linked to commits and sessions
- **Workflow notes** — how to enable Entire and record milestones
- **Judging inputs** — place for eval screenshots and digest samples (add as needed; keep secrets out)

## Architecture / how it works

```text
Cursor agent session
        │
        ▼
Entire hooks / session attach
        │
        ▼
git commit (optional Entire-Checkpoint trailer)
        │
        ▼
evidence/checkpoints.json  ←─ human records ID + summary
        │
        ▼
git push origin  (Entire checkpoint refs sync with push)
```

Product code and unit tests live elsewhere (`src/`, `web/`, `tests/`). This directory only documents **iteration proof**.

## Prerequisites & requirements

| Requirement | Notes |
| --- | --- |
| [Entire CLI](https://docs.entire.io) | `entire enable`, agent hooks for Cursor |
| Git remote | Checkpoints sync on `git push origin` |
| Repo setting | [`.entire/settings.json`](../.entire/settings.json) |

## Installation & quickstart

```bash
# From repo root
entire enable --agent cursor
entire status
```

After a milestone change:

```bash
git add -A
git commit -m "Describe the product improvement."
# If hooks did not create a checkpoint:
entire session attach <session-id> --agent cursor --force
# Append the checkpoint id to evidence/checkpoints.json
git push origin HEAD
```

## Configuration

No environment variables are required for this folder.

| File | Purpose |
| --- | --- |
| `checkpoints.json` | List of `{ id, commit, summary, session, agent, at }` |
| This README | Workflow for judges and contributors |

## Usage examples

Record format (see existing entries in [`checkpoints.json`](./checkpoints.json)):

```json
{
  "id": "01M4RHNK71ZEPWNW58MQ8XY59H",
  "commit": "d9b375a",
  "summary": "Responsive card alignment + HITL follow-ups",
  "session": "6afb87e4-68a2-4911-ac00-8cc07d0753f7",
  "agent": "cursor",
  "at": "2026-10-12T22:43:00+05:30"
}
```

Optional artifacts to add locally (do not commit secrets):

1. Screenshots of neatlogs evals (hallucination, trigger-precision, draft-quality)
2. Sample digest markdown from a live EC2 run (`credits/` or digest path from a cycle)

## Testing

```bash
entire status
entire checkpoint list
entire doctor
```

Validate that `checkpoints.json` IDs appear in `entire checkpoint list` after push.

## Contributing

1. Append checkpoints after real product milestones (not empty commits)
2. Keep summaries factual and tied to a commit SHA
3. Never paste API keys, OAuth tokens, or `.env` contents into this folder
4. Prefer linking Entire IDs over duplicating large transcripts in git

## License & acknowledgments

MIT — see [../LICENSE](../LICENSE).

**Entire** ([entire.io](https://entire.io)) provides session ↔ commit checkpoints used for neatHack “iteration” proof alongside neatlogs traces and cfo.ai unit economics in the root project.
