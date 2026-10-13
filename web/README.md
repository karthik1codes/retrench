# Signal Scout — Web

[![Next.js 15](https://img.shields.io/badge/Next.js-15-black.svg)](./package.json)
[![Version 0.1.0](https://img.shields.io/badge/version-0.1.0-informational.svg)](./package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

## Elevator pitch

Next.js product UI for Signal Scout: sign in with Google, run company scouts, review evidence-backed drafts, approve or reject them, and open Gmail (or agent-send after approve). The browser never talks to CrustData or Neo4j directly — Next.js API routes proxy to the Python agent on `:8787`.

## Key features

- **Scout Studio** — domain/name in → signals + draft workspace (`/scout`)
- **Overview / watchlist** — live stats and this-week companies (`/dashboard`, `/watchlist`)
- **Sent & follow-ups** — store sends; queue +3d bump / +7d close for HITL (`/sent`, `/follow-ups`)
- **Google Auth.js** — openid/email/profile + `gmail.readonly` / `gmail.send` for verify/send
- **HITL preferences** — human-in-the-loop vs agent-send after Approve
- **Agent proxy** — `/api/scout`, `/api/targets`, `/api/overview`, `/api/drafts`, `/api/contacts`, `/api/draft-action`, Gmail routes
- **Demo fallback** — optional fixtures when `SCOUT_FALLBACK_DEMO=1` or agent unreachable

## Architecture / how it works

```text
Browser
  │
  ├─ pages: /scout /dashboard /watchlist /sent /follow-ups /login /privacy /terms
  │
  ▼
Next.js Route Handlers (web/src/app/api/*)
  │  SCOUT_AGENT_URL + SCOUT_API_TOKEN (X-Scout-Token)
  ▼
Python agent  :8787   (python -m signalscout serve)
  │
  ▼
Neo4j + CrustData + OpenRouter
```

If `:8787` is down, security group blocks the host, or `SCOUT_AGENT_URL` is wrong, `/api/targets` returns `unavailable` and Scout shows empty/error (or demo fixtures if enabled).

## Prerequisites & requirements

| Requirement | Notes |
| --- | --- |
| Node.js | 20+ recommended |
| npm | Ships with Node |
| Python agent | Running `signalscout serve` (see [root README](../README.md)) |
| Google Cloud | OAuth client + Gmail API for send/verify ([`GOOGLE_OAUTH_SETUP.md`](./GOOGLE_OAUTH_SETUP.md)) |

## Installation & quickstart

```powershell
# Terminal A — agent (repo root)
cd D:\neatlogs
$env:PYTHONPATH = "D:\neatlogs\src"
python -m signalscout serve --host 127.0.0.1 --port 8787

# Terminal B — web
cd D:\neatlogs\web
Copy-Item env.local.example .env.local
# Edit .env.local: SCOUT_AGENT_URL, AUTH_*, SCOUT_API_TOKEN
npm install
npm run dev
```

```bash
cd /path/to/neatlogs/web
cp env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. Production deploy notes: [`VERCEL_DEPLOY.md`](./VERCEL_DEPLOY.md).

## Configuration

Copy [`env.local.example`](./env.local.example) → `.env.local`. Vercel: [`env.vercel.example`](./env.vercel.example).

| Name | Default | Description |
| --- | --- | --- |
| `SCOUT_AGENT_URL` | `http://127.0.0.1:8787` | Base URL of Python HTTP API (no trailing slash) |
| `SCOUT_API_TOKEN` | `change-me` | Must match agent `SCOUT_API_TOKEN` (`X-Scout-Token`) |
| `SCOUT_FALLBACK_DEMO` | `0` | `1` / `true` → demo fixtures when agent fails |
| `AUTH_SECRET` | _(required)_ | Auth.js secret (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` | _(required for login)_ | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | _(required for login)_ | Google OAuth client secret |
| `AUTH_URL` | `http://localhost:3000` | Canonical app URL (must match OAuth redirect host) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public app URL for links |

| Mode | `SCOUT_AGENT_URL` | `SCOUT_FALLBACK_DEMO` | Data |
| --- | --- | --- | --- |
| Live agent | `http://127.0.0.1:8787` or EC2 | `0` | Neo4j + CrustData via agent |
| UI demo only | unset / unreachable | `1` | Fixture drafts/contacts |

## Usage examples

### Smoke-test the agent before the UI

```powershell
curl.exe -s http://127.0.0.1:8787/health
curl.exe -s -H "X-Scout-Token: change-me" "http://127.0.0.1:8787/targets?days=7"
curl.exe -s -X POST -H "Content-Type: application/json" -H "X-Scout-Token: change-me" `
  -d "{\"domain\":\"ramp.com\"}" http://127.0.0.1:8787/scout
```

`/targets` only lists companies with drafts in the last 7 days — scout at least once first.

### App routes (signed-in)

| Path | Purpose |
| --- | --- |
| `/scout` | Run scout, edit draft, Approve / send |
| `/dashboard` | Overview stats + signals |
| `/watchlist` | Weekly candidates |
| `/sent` | Stored sends |
| `/follow-ups` | Pending +3d / +7d follow-ups |
| `/privacy`, `/terms` | Public legal pages (OAuth verification) |

### Offline agent (memory graph)

```powershell
$env:NEO4J_URI = "memory"
$env:PYTHONPATH = "D:\neatlogs\src"
python -m signalscout serve --host 127.0.0.1 --port 8787
# separate shell:
python -m signalscout scout --domain ramp.com
```

## Testing

```powershell
cd D:\neatlogs\web
npm run lint
npm run build
```

There is no separate Jest suite in this package; agent behavior is covered by root `pytest` (see [../README.md](../README.md#testing)).

## Contributing

1. Branch from `main`
2. Keep `web/.env.local` untracked
3. Match existing shadcn / app-shell patterns under `src/components`
4. Proxy new agent capabilities through `src/app/api/*` — do not call EC2 from the browser
5. Run `npm run lint` and `npm run build` before PR
6. OAuth / domain steps stay in [`GOOGLE_OAUTH_SETUP.md`](./GOOGLE_OAUTH_SETUP.md) and [`VERCEL_DEPLOY.md`](./VERCEL_DEPLOY.md)

## License & acknowledgments

MIT — see [../LICENSE](../LICENSE).

Depends on the Signal Scout Python agent ([`../src/signalscout`](../src/signalscout)), Auth.js, and Google Gmail OAuth. Stack partners: CrustData, neatlogs, Entire, cfo.ai (see root README).
