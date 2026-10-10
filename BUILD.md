# What to build now (Retrench)

This is the execution guide for the product in [README.md](./README.md).

## Goal (hackathon MVP)

Ship a **keep / fix / kill** portfolio for AI features where every serious screen has three chapters:

1. **Runtime** → [neatlogs.com](https://neatlogs.com)  
2. **Change** → [entire.io](https://entire.io)  
3. **Money** → [cfo.ai](https://cfo.ai)

UI must use **[shadcn/ui](https://ui.shadcn.com)** components (already under `web/src/components/ui`).

---

## Env file (`env` → `.env.local`)

Your root `env` file is **gitignored**. Map it like this:

| `env` key | App env var | Where |
| --- | --- | --- |
| `NEATLOGS_PROJECT_API_KEY` | `NEATLOGS_API_KEY` | `web/.env.local` |
| `aws_account_id` | `AWS_ACCOUNT_ID` | console / deploy notes |
| `aws_iam_username` / `aws_iam_password` | console login only | **never** commit; prefer EC2 instance role |

Still add (from dashboards):

- `NEATLOGS_PROJECT_ID` — from neatlogs project settings  
- `CFO_AI_ACCESS_TOKEN` + optional `CFO_AI_ORG_ID` — from cfo.ai MCP OAuth  
- `OPENROUTER_API_KEY` — for demo `checkout_agent` (optional `OPENROUTER_MODEL`)  

Template: [`.env.example`](./.env.example).

`USE_MOCK_DATA=true` runs the README Checkout Recovery demo without live tokens.  
Set `USE_MOCK_DATA=false` once neatlogs + cfo tokens work.

**Security:** rotate the IAM password if `env` was shared. Never push `env` / `.env.local`.

---

## Compulsory integrations

| Product | Code | Must do |
| --- | --- | --- |
| neatlogs | `web/src/lib/neatlogs.ts` | List/get traces; instrument demo agent |
| entire.io | `web/src/lib/entire.ts` | Read `.entire` checkpoints after `entire enable` |
| cfo.ai | `web/src/lib/cfo.ts` | Deterministic margin + MCP when token set |

Orchestrator: `web/src/lib/retrench.ts`.

---

## App map (already scaffolded)

```text
web/                     Next.js + Tailwind + shadcn/ui
  src/app/               Portfolio + feature investigate pages
  src/app/api/features   README API sketch
  src/components/ui      shadcn components
demo/agents/             neatlogs-instrumented checkout_agent.py
infra/AWS.md             Hackathon AWS steps
```

### Run locally

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000 → portfolio → **Checkout Recovery** → three chapters.

### Demo agent → neatlogs

```bash
pip install neatlogs openai
# export NEATLOGS_API_KEY=...  OPENROUTER_API_KEY=...
python demo/agents/checkout_agent.py
```

### Entire

```bash
# from repo root
entire enable --agent cursor
# make a coding-agent commit so a checkpoint exists
```

### cfo.ai

1. Create workspace + Feature assumptions (AOV, margin, cost/failure)  
2. Connect MCP (`https://api.cfo.ai/mcp`)  
3. Put token in `CFO_AI_ACCESS_TOKEN`  
4. Set `USE_MOCK_DATA=false`

---

## AWS (summary)

See [infra/AWS.md](./infra/AWS.md).

1. Login console as hackathon IAM user (**us-east-1**)  
2. Use **Hackathon_VPC** only  
3. One **t3.small** EC2 ≤ 50 GB EBS  
4. ALB → EC2:3000 (`/api/health`)  
5. Optional Lambda every 15m hitting `/api/features`  
6. Stop/terminate when done ($25)

---

## Build order (next tasks)

1. Open **http://localhost:3000/setup** — neatlogs + Entire green  
2. Ensure `NEATLOGS_TOKEN` (service account) is in **`web/.env.local`**  
3. Run `checkout_agent.py` → live traces  
4. Open **/agent** → **Run tick** (or `python demo/agents/retrench_control_agent.py`)  
5. Confirm Fix brief under `web/.retrench/briefs/` when cliff detected  
6. Deploy **one** EC2: `infra/ec2-bootstrap.sh` (UI + control-agent systemd)  
7. Optional Lambda 15m → `/api/agent/tick`  
8. Demo script from README §8 Phase 4  

### Autonomous control agent

| Piece | Path |
| --- | --- |
| Tick API | `POST /api/agent/tick` |
| State | `GET /api/agent/state` |
| Watchdog | `POST /api/agent/watchdog` |
| UI | `/agent` |
| Long-running process | `demo/agents/retrench_control_agent.py` |
| EC2 | `retrench-agent.service` in `infra/ec2-bootstrap.sh` |

---

## Success (from README)

Judges see: portfolio → regression → Investigate (runtime + change + money) → fix brief → Watchdog path — with all three products named and used.
