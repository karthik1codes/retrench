# Signal Scout — Web UI

Next.js product UI for Scout Studio, dashboard, and watchlist. Talks to the Python agent HTTP API on `:8787`.

## Why `/api/targets` fails

The browser calls **Next.js** → `GET /api/targets` → server-side fetch to `SCOUT_AGENT_URL/targets`.

If EC2 `:8787` is down, SG blocks your IP, or the public IP changed, that proxy returns empty/`unavailable` and Scout falls back to the seed company list.

**Fix:** run the agent locally (below) **or** keep EC2 API up with SG `8787` = My IP.

## Env (`web/.env.local`)

```bash
# Local agent (recommended for dev)
SCOUT_AGENT_URL=http://127.0.0.1:8787
SCOUT_API_TOKEN=change-me
SCOUT_FALLBACK_DEMO=0

# Or EC2 (must match live public IP + SG)
# SCOUT_AGENT_URL=http://YOUR_PUBLIC_IP:8787

AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_URL=http://localhost:3000
```

| Mode | `SCOUT_AGENT_URL` | `SCOUT_FALLBACK_DEMO` | Data |
| --- | --- | --- | --- |
| Live agent | `http://127.0.0.1:8787` or EC2 | `0` | Neo4j + CrustData |
| UI demo only | unset / unreachable | `1` | Fixture drafts/contacts |

Copy from `web/env.local.example`.

## Run UI

```powershell
cd D:\neatlogs\web
npm run dev
```

Open http://localhost:3000 → Scout.

## Test agent API (PowerShell)

From repo root, with Neo4j up (or memory graph):

```powershell
cd D:\neatlogs

# Terminal A — Neo4j (skip if NEO4J_URI=memory)
docker compose -f deploy/docker-compose.yml up -d neo4j

# Point agent at Neo4j + keys (root .env.local)
# NEO4J_URI=bolt://localhost:7687
# CRUSTDATA_API_KEY=...
# SCOUT_API_TOKEN=change-me

# Terminal B — HTTP API
$env:PYTHONPATH="D:\neatlogs\src"
python -m signalscout serve --host 127.0.0.1 --port 8787
```

Smoke tests:

```powershell
curl.exe -s http://127.0.0.1:8787/health

curl.exe -s -H "X-Scout-Token: change-me" "http://127.0.0.1:8787/targets?days=7"

curl.exe -s -X POST -H "Content-Type: application/json" -H "X-Scout-Token: change-me" `
  -d "{\"domain\":\"ramp.com\"}" http://127.0.0.1:8787/scout

curl.exe -s -H "X-Scout-Token: change-me" "http://127.0.0.1:8787/overview"

curl.exe -s -H "X-Scout-Token: change-me" "http://127.0.0.1:8787/watchlist?days=14"
```

Then point `web/.env.local` at `http://127.0.0.1:8787`, restart `npm run dev`, refresh Scout — targets should load after at least one scout/cycle wrote drafts.

## Offline / memory graph

```powershell
$env:NEO4J_URI="memory"
$env:PYTHONPATH="D:\neatlogs\src"
python -m signalscout serve --host 127.0.0.1 --port 8787
python -m signalscout scout --domain ramp.com
```

`/targets` only lists companies with drafts in the last 7 days — scout once first.
