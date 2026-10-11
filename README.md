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

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -e ".[dev]"

# memory graph for tests / offline
set NEO4J_URI=memory   # PowerShell: $env:NEO4J_URI="memory"
pytest -q

# full cycle with in-memory graph + mocked path via tests;
# live cycle needs Neo4j + CRUSTDATA_API_KEY:
docker compose -f deploy/docker-compose.yml up -d neo4j
$env:NEO4J_URI="bolt://localhost:7687"
$env:NEO4J_PASSWORD="signalscout"
# put keys in .env.local
python -m signalscout run --config segment.yaml
```

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
| `systemd/signal-scout.timer` | every 6h oneshot cycle |
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
5. `--dry-run` — no external API  
6. `:Run.credits_spent` ≤ `credit_budget_per_cycle` in `segment.yaml`  

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
