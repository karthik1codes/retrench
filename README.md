# Signal Scout

Autonomous **trigger-event GTM agent** for [neatHack](https://neatlogs.com/hackathon).

> 30% of B2B contacts go stale within 12 months. Signal Scout only acts on events that are **real and this week** — funding, hiring surges, exec hires — then drafts evidence-backed outreach (**never sends**).

**Input:** one file — [`segment.yaml`](./segment.yaml)  
**Brain:** Neo4j property graph (no SQLite)  
**Tools:** CrustData · neatlogs · Entire · cfo.ai  
**Runtime:** EC2 + Docker Compose + systemd timer (one cycle per invocation)

## Architecture

```text
segment.yaml → Signal Agent (CrustData + graph diff)
            → Research Agent (qualify / archive)
            → Draft Agent (CITES evidence only)
            → Watchlist Agent (nightly digest → S3/local)
                 ↑
            Neo4j (:Run / :Signal checkpoint = crash resume)
```

## Quick start (local)

**PowerShell**

```powershell
cd D:\neatlogs
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item .env.example .env.local   # fill CRUSTDATA_API_KEY, OPENROUTER_*, etc.

# Offline tests (no Neo4j)
$env:NEO4J_URI="memory"
pytest -q

# Live Neo4j + one cycle
docker compose -f deploy/docker-compose.yml up -d neo4j
$env:NEO4J_URI="bolt://localhost:7687"
$env:NEO4J_PASSWORD="signalscout"
python -m signalscout run --config segment.yaml
```

**Bash**

```bash
cd /path/to/neatlogs
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env.local   # fill keys
NEO4J_URI=memory pytest -q
docker compose -f deploy/docker-compose.yml up -d neo4j
python -m signalscout run --config segment.yaml
```

### Web UI + agent API (targets / scout)

See [`web/README.md`](./web/README.md). Short path:

```powershell
# Terminal A — agent API (repo root)
$env:PYTHONPATH="D:\neatlogs\src"
python -m signalscout serve --host 127.0.0.1 --port 8787

# Terminal B — Next.js
cd web
# web/.env.local → SCOUT_AGENT_URL=http://127.0.0.1:8787
npm run dev
```

| Mode | Meaning |
| --- | --- |
| `NEO4J_URI=memory` | In-memory graph (tests / offline serve) |
| `NEO4J_URI=bolt://…` | Live Neo4j |
| `SCOUT_FALLBACK_DEMO=1` | UI fixtures when agent unreachable (disclose in demo) |

**Limitations (disclose):** interactive scout may emit a synthetic `profile` signal when classic triggers miss; `/person/contact/enrich` is 403 → we use `/person/enrich`; scheduled cycles suppress re-draft if the same company was drafted ≤7 days (`do-not-contact`) or `Company.support_risk` is set.

## vs LangChain GTM agent

We studied [How we built LangChain’s GTM Agent](https://www.langchain.com/blog/how-we-built-langchains-gtm-agent) and stole **trust + HITL + evals**, not their stack.

| Their pattern | Signal Scout |
| --- | --- |
| Do-not-send (recent touch / support) | Scheduled DraftAgent: `recent_touch` ≤7d + stub `support_risk` → signal `suppressed` |
| Slack Approve / Edit / Cancel | Scout workspace Approve / Edit / Reject → `POST /draft-action` → neatlogs |
| Reasoning + sources | Why now + `CITES` evidence hashes in UI |
| Evals-first CI | `pytest tests/test_gtm_golden.py` (funding / surge / exec / duplicate / suppress) |

**Out of scope (on purpose):** Salesforce, Gong, BigQuery, Slack bot, 48h auto-send SLA, per-rep style memory, Deep Agents FS. Scout never sends email — human opens Gmail/Outlook after Approve.

## CLI

```bash
python -m signalscout run --config segment.yaml
python -m signalscout run --dry-run          # replay graph, zero external API
python -m signalscout bootstrap-graph
```

## AWS (unattended)

See [`deploy/`](./deploy):

| Piece | Role |
| --- | --- |
| `docker-compose.yml` | Neo4j + agent image |
| `systemd/signal-scout.timer` | every 1h oneshot cycle |
| `ssm_bootstrap.sh` | SecureString → `.env.runtime` |
| `iam-policy.json` | SSM / S3 / Session Manager |

**Hackathon allowlist note:** organizers allow **EC2, Lambda, IAM, ALB**. Docker on the instance is fine. If **S3 / SSM / CloudWatch** are blocked, use `.env.local` on disk + local `credits/evidence/` (already supported) and Session Manager or SSH per your account.

**Access preference:** SSM Session Manager (no open SSH). If your account has no public IP path, use that.

```bash
# on Ubuntu EC2 after clone to /opt/signalscout
sudo bash deploy/ssm_bootstrap.sh
docker compose -f deploy/docker-compose.yml up -d neo4j
sudo cp deploy/systemd/* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now signal-scout.timer
sudo systemctl start signal-scout.service
```

## Acceptance tests

1. `python -m signalscout run --config segment.yaml` exits 0  
2. Kill mid-run → next timer resumes via `:Signal` / `:Run` (MERGE idempotent)  
3. CrustData 429 → backoff in client; run marked failed; next succeeds  
4. `pytest tests/test_draft_cites.py` — 20 drafts, all CITES evidence  
5. `pytest tests/test_gtm_golden.py` — GTM golden cases (cites, idempotent, suppress)  
6. `--dry-run` — no external API  
7. `:Run.credits_spent` ≤ `credit_budget_per_cycle` in `segment.yaml`  

```bash
pytest -q
```

## Repo layout

```text
src/signalscout/   agents, orchestrator, graph, crustdata client
graph/             Cypher schema
deploy/            compose, systemd, SSM, IAM
evidence/          Entire checkpoint IDs
business/          cfo.ai plan + cost JSON
credits/           per-run CrustData usage
segment.yaml       only human input
```

## Demo script (5 min)

1. Pain: 30% contact decay → stale personalization  
2. Show `segment.yaml`  
3. Live / recorded EC2 cycle → digest like PayFlow 92 funding  
4. neatlogs traces (agent, signal id, cost)  
5. Entire before/after checkpoints in `/evidence`  
6. Neo4j: `(Draft)-[:CITES]->(Evidence)<-[:EVIDENCED_BY]-(Signal)`  
7. cfo.ai from `business/cost_per_qualified_lead.json`  

## License

MIT — hackathon build.
