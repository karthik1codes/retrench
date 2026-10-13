# Signal Scout

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](./pyproject.toml)
[![Version 0.1.0](https://img.shields.io/badge/version-0.1.0-informational.svg)](./pyproject.toml)
[![neatHack](https://img.shields.io/badge/neatHack-GTM%20agent-red.svg)](https://neatlogs.com/hackathon)

## Elevator pitch

Signal Scout is a trigger-event GTM agent for outbound teams and hackathon judges: it watches live company signals (funding, hiring, exec moves), qualifies them, and drafts short evidence-backed emails — then stops. Humans approve and send. Static lists go stale; this system only acts when something material happened this week.

## Key features

- **One-file ICP** — [`segment.yaml`](./segment.yaml) is the only human config for segment filters and triggers
- **Four-agent cycle** — Signal → Research → Draft → Watchlist (not a single prompt)
- **Evidence-backed drafts** — Neo4j `(Draft)-[:CITES]->(Evidence)`; drafts cannot invent uncited numbers
- **Do-not-contact guard** — scheduled Draft Agent suppresses re-draft if the company was drafted ≤7 days or `support_risk` is set
- **Crash resume** — `:Run` / `:Signal` state in Neo4j; idempotent merges
- **Credit budget** — CrustData usage tracked per cycle; written to `business/cost_per_qualified_lead.json`
- **HTTP API + Next.js UI** — Scout Studio, overview, watchlist, sent/follow-ups; Gmail HITL after Approve
- **Dry-run mode** — replay unfinished graph work with zero external API calls
- **EC2 timer deploy** — Docker Compose + systemd oneshot under [`deploy/`](./deploy)

## Architecture / how it works

```text
segment.yaml
    │
    ▼
┌─────────────┐   CrustData + graph diff   ┌──────────────┐
│ Signal Agent│ ─────────────────────────► │ Neo4j graph  │
└─────────────┘                            │ :Run :Signal │
    │                                      │ Company Draft│
    ▼                                      │ Evidence     │
┌──────────────┐  qualify / archive        └──────▲───────┘
│Research Agent│ ─────────────────────────────────┘
└──────────────┘
    │
    ▼
┌────────────┐  CITES evidence · suppress recent_touch
│ Draft Agent│
└────────────┘
    │
    ▼
┌────────────────┐
│ Watchlist Agent│  digest → local credits/ or S3
└────────────────┘

Product UI (web/) ──► Next.js /api/* ──► SCOUT_AGENT_URL (:8787)
Traces: neatlogs · Checkpoints: Entire · Unit economics: cfo.ai
```

| Agent | Role |
| --- | --- |
| Signal | Pull CrustData, diff vs graph, create signals + evidence |
| Research | Qualify or archive noise |
| Draft | ≤~90-word cite-backed draft; suppress when appropriate |
| Watchlist | This-week digest of who to reach |

Interactive path: `python -m signalscout scout --domain …` or UI `POST /api/scout` → same pipeline for one company.

## Prerequisites & requirements

| Requirement | Notes |
| --- | --- |
| Python | ≥ 3.11 ([`pyproject.toml`](./pyproject.toml)) |
| Node.js | 20+ (for `web/`; Next.js 15) |
| Docker | Optional; Neo4j via [`deploy/docker-compose.yml`](./deploy/docker-compose.yml) |
| API keys | CrustData, OpenRouter (LLM), optional neatlogs, Google OAuth for Gmail UI |
| Neo4j | Live `bolt://…` **or** `NEO4J_URI=memory` for offline/tests |

## Installation & quickstart

### Agent (PowerShell)

```powershell
cd D:\neatlogs
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item .env.example .env.local
# Fill CRUSTDATA_API_KEY, OPENROUTER_API_KEY, NEO4J_* in .env.local

# Offline tests (no Neo4j server)
$env:NEO4J_URI = "memory"
pytest -q

# Live Neo4j + one cycle
docker compose -f deploy/docker-compose.yml up -d neo4j
$env:NEO4J_URI = "bolt://localhost:7687"
$env:NEO4J_PASSWORD = "signalscout"
python -m signalscout run --config segment.yaml
```

### Agent (Bash)

```bash
cd /path/to/neatlogs
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env.local   # fill keys
NEO4J_URI=memory pytest -q
docker compose -f deploy/docker-compose.yml up -d neo4j
NEO4J_URI=bolt://localhost:7687 NEO4J_PASSWORD=signalscout \
  python -m signalscout run --config segment.yaml
```

### Web UI + agent API

```powershell
# Terminal A — from repo root
$env:PYTHONPATH = "D:\neatlogs\src"
python -m signalscout serve --host 127.0.0.1 --port 8787

# Terminal B
cd web
Copy-Item env.local.example .env.local   # SCOUT_AGENT_URL=http://127.0.0.1:8787
npm install
npm run dev
```

Open http://localhost:3000. Full UI docs: [`web/README.md`](./web/README.md).

| Mode | Meaning |
| --- | --- |
| `NEO4J_URI=memory` | In-memory graph (tests / offline serve) |
| `NEO4J_URI=bolt://…` | Live Neo4j |
| `SCOUT_FALLBACK_DEMO=1` | UI fixtures when agent unreachable (disclose in demos) |

**Limitations:** interactive scout may emit a synthetic `profile` signal when classic triggers miss; CrustData `/person/contact/enrich` 403 falls back to `/person/enrich`; scheduled cycles suppress re-draft ≤7 days (`recent_touch`) or when `Company.support_risk` is set.

## Configuration

Copy [`.env.example`](./.env.example) → `.env.local` (never commit secrets).

| Name | Default | Description |
| --- | --- | --- |
| `CRUSTDATA_API_KEY` | _(empty)_ | CrustData API key for company/people reads |
| `OPENROUTER_API_KEY` | _(empty)_ | LLM calls (research / draft / rewrite) |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | OpenRouter model id |
| `NEO4J_URI` | `bolt://localhost:7687` | Graph URI; use `memory` offline |
| `NEO4J_USER` | `neo4j` | Neo4j user |
| `NEO4J_PASSWORD` | `signalscout` | Neo4j password (compose default) |
| `SCOUT_API_TOKEN` | `change-me` | `X-Scout-Token` for HTTP API |
| `NEATLOGS_API_KEY` | _(empty)_ | Optional cycle + HITL tracing |
| `NEATLOGS_INGEST_ENDPOINT` | `https://ingest.neatlogs.com` | neatlogs ingest URL |
| `AWS_REGION` | `us-east-1` | Optional AWS region |
| `SSM_PREFIX` | `/signalscout` | SSM parameter prefix |
| `SIGNAL_SCOUT_S3_BUCKET` | _(empty)_ | Optional evidence bucket |

Web env: see [`web/env.local.example`](./web/env.local.example) and [`web/README.md`](./web/README.md).

Segment behavior (budget, triggers, filters): edit [`segment.yaml`](./segment.yaml).

## Usage examples

### CLI

```bash
python -m signalscout run --config segment.yaml
python -m signalscout run --dry-run
python -m signalscout scout --domain ramp.com
python -m signalscout bootstrap-graph
python -m signalscout serve --host 0.0.0.0 --port 8787
```

### HTTP API (agent on `:8787`)

```bash
curl -s http://127.0.0.1:8787/health

curl -s -H "X-Scout-Token: change-me" \
  "http://127.0.0.1:8787/targets?days=7"

curl -s -X POST -H "Content-Type: application/json" \
  -H "X-Scout-Token: change-me" \
  -d '{"domain":"ramp.com"}' \
  http://127.0.0.1:8787/scout
```

Routes include: `/health`, `/drafts`, `/overview`, `/targets`, `/watchlist`, `/scout`, `/contacts`, `/draft-action`, `/rewrite-draft`, `/user/profile`.

### Unattended EC2

See [`deploy/README.md`](./deploy/README.md). Short path:

```bash
sudo bash deploy/ssm_bootstrap.sh
docker compose -f deploy/docker-compose.yml up -d neo4j
sudo cp deploy/systemd/* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now signal-scout.timer
```

### Demo video script

Spoken beat sheet: [`DEMO_VIDEO_SCRIPT.md`](./DEMO_VIDEO_SCRIPT.md).

## Testing

```bash
# From repo root, with package installed editable
NEO4J_URI=memory pytest -q
```

| Test | What it covers |
| --- | --- |
| `tests/test_draft_cites.py` | Drafts must CITES evidence |
| `tests/test_gtm_golden.py` | Funding / surge / exec / duplicate / suppress |
| `tests/test_signal_funding_idempotent.py` | Signal merge idempotency |
| `tests/test_draft_numbers.py` | Number stripping / cite safety |
| `tests/test_user_profile_merge.py` | User profile merge behavior |

Acceptance checklist:

1. `python -m signalscout run --config segment.yaml` exits 0  
2. Kill mid-run → next cycle resumes via `:Signal` / `:Run`  
3. CrustData 429 → client backoff; run can fail and retry later  
4. `--dry-run` makes no external API calls  
5. `:Run.credits_spent` ≤ `credit_budget_per_cycle` in `segment.yaml`

## Contributing

1. Fork / branch from `main` (`feature/…` or `fix/…`)
2. Keep secrets out of git (`.env.local`, `.env.runtime`)
3. Run `NEO4J_URI=memory pytest -q` before opening a PR
4. Prefer small PRs: agent logic, web UI, or deploy — not all three at once
5. Document new env vars in `.env.example` and this README
6. For product milestones, record Entire checkpoint IDs in [`evidence/checkpoints.json`](./evidence/checkpoints.json)

Do not invent endpoints or scopes beyond what `src/signalscout/http_api.py` and `web/src/app/api/` already expose.

## License & acknowledgments

**License:** [MIT](./LICENSE) — Copyright (c) 2026 M KARTHIK.

**Built for** [neatHack](https://neatlogs.com/hackathon) with:

| Tool | Role in this repo |
| --- | --- |
| [CrustData](https://crustdata.com) | Live company / people signals |
| [neatlogs](https://neatlogs.com) | Agent cycle + HITL traces |
| [Entire](https://entire.io) | Session ↔ commit checkpoints (`evidence/`) |
| [cfo.ai](https://cfo.ai) | Unit economics from `business/cost_per_qualified_lead.json` |
| Neo4j | Durable graph memory |

Patterns borrowed (trust + HITL, not their stack): [LangChain GTM agent](https://www.langchain.com/blog/how-we-built-langchains-gtm-agent).

### Repo layout

```text
src/signalscout/   agents, orchestrator, graph, CrustData client, HTTP API
web/               Next.js UI + Auth.js Google / Gmail
graph/             Cypher schema helpers
deploy/            compose, systemd, SSM, IAM
tests/             pytest suite
evidence/          Entire checkpoint IDs
business/          cfo.ai plan + cost JSON
credits/           per-run credit digests (gitignored content)
segment.yaml       only human segment input
DEMO_VIDEO_SCRIPT.md
```
