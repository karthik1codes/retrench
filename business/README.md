# Signal Scout — Business / cfo.ai

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

## Elevator pitch

Unit-economics inputs for [cfo.ai](https://cfo.ai): each agent cycle can write measured CrustData credits per qualified lead into JSON so Ari can model Starter / Growth / Scale pricing. This folder is planning data, not the runtime agent.

## Key features

- **`cost_per_qualified_lead.json`** — emitted/updated from live cycles (`credits_spent`, qualified count, credits per lead)
- **`cfo_plan.md`** — how to ingest that JSON into cfo.ai and which assumptions to replace with dashboard pricing

## Architecture / how it works

```text
signalscout run / cycle
        │
        ▼
CreditLedger (CrustData X-Credits-Used)
        │
        ▼
business/cost_per_qualified_lead.json
        │
        ▼
cfo.ai (manual ingest / Ari plan)
```

## Prerequisites & requirements

| Requirement | Notes |
| --- | --- |
| Completed agent cycle | So `credits_spent` is meaningful |
| cfo.ai account | Optional; for neatHack business proof |
| CrustData pricing | Convert credits → $ carefully (credit ≠ dollar until contracted) |

## Installation & quickstart

No install. After a live cycle with Neo4j + CrustData:

```bash
# From repo root
python -m signalscout run --config segment.yaml
cat business/cost_per_qualified_lead.json
```

Paste or attach values into your cfo.ai plan per [`cfo_plan.md`](./cfo_plan.md).

## Configuration

No dedicated env vars. Cycle budget comes from [`segment.yaml`](../segment.yaml) (`credit_budget_per_cycle`).

| File | Description |
| --- | --- |
| `cost_per_qualified_lead.json` | Latest measured unit cost snapshot |
| `cfo_plan.md` | Narrative + metrics table for Ari |

## Usage examples

Example shape (values change per run):

```json
{
  "run_id": "run-…",
  "credits_spent": 4.65,
  "qualified_or_drafted": 5,
  "cost_per_qualified_lead_credits": 0.93
}
```

In cfo.ai: set credits-per-lead from this file, then model LLM $/draft and EC2 fixed cost separately (see plan doc).

## Testing

```bash
# Ensure a dry cycle still writes a JSON object (may be zeros offline)
python -m signalscout run --dry-run --config segment.yaml
python -c "import json; json.load(open('business/cost_per_qualified_lead.json'))"
```

Treat small-sample runs as baselines, not production averages.

## Contributing

1. Do not hard-code fake “proven” averages in `cfo_plan.md` without labeling them provisional
2. Prefer measured JSON from EC2 over invented margins
3. Keep secrets (API keys, account IDs) out of this folder

## License & acknowledgments

MIT — see [../LICENSE](../LICENSE).

**cfo.ai** is used for neatHack unit-economics storytelling alongside CrustData credit ledgers and neatlogs LLM cost traces.
