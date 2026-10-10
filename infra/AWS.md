# Retrench on AWS (hackathon)

## Credentials from `env`

| Field in `env` | Use |
| --- | --- |
| `NEATLOGS_PROJECT_API_KEY` / ingest key | `NEATLOGS_API_KEY` — agent writes traces |
| Service-account token | `NEATLOGS_TOKEN` — Retrench Public API reads |
| `aws_account_id` | Console account `063028693684` |
| `aws_iam_username` / `aws_iam_password` | **Console login only** — never in user-data or git |

## Hard rules

- Region: **us-east-1**
- Network: supplied **Hackathon_VPC** only — **do not create a VPC**
- Services: **EC2**, **Lambda**, **IAM roles**, **ALB** only
- **One EC2** per team (`t2`/`t3`/`t3a`, nano–large, EBS ≤ 50 GB)
- Budget: **$25** — stop/terminate when finished
- **No GPU / no ML training cluster** — “train/test agents” = rehearse the control loop on this single EC2

## Topology

```text
Internet → ALB → EC2 (t3.small)
                 ├─ systemd: retrench.service      (Next.js :3000)
                 ├─ systemd: retrench-agent.service (autonomous control loop)
                 └─ outbound HTTPS → neatlogs, Entire, cfo.ai

EventBridge (15m) → Lambda → POST /api/agent/tick  (+ GET /api/features)
```

## What runs on the EC2

| Process | Role |
| --- | --- |
| Next.js Retrench | Portfolio / Investigate / Agent UI |
| `retrench_control_agent.py` | Watch cliffs → investigate → keep/fix/kill → fix brief / pause → Watchdog |
| `checkout_agent.py` (manual) | Generate neatlogs traces for demos |

## EC2 bootstrap

Script: [`ec2-bootstrap.sh`](./ec2-bootstrap.sh)

```bash
# SSH to the instance, then:
bash infra/ec2-bootstrap.sh
```

Create `web/.env.local` first (never from git):

```bash
# Required for live control agent
NEATLOGS_API_KEY=...          # ingest
NEATLOGS_TOKEN=...            # service account, observability:read
NEATLOGS_PROJECT_ID=...
USE_MOCK_DATA=false
OPENROUTER_API_KEY=...        # for checkout_agent demos
```

ALB target: port **3000**. Health: `GET /api/health`.

## Test / rehearse agents on EC2

```bash
# one-shot control tick
curl -X POST http://127.0.0.1:3000/api/agent/tick | jq .

# long-running agent (also via systemd)
AGENT_TICK_SECONDS=60 python3 demo/agents/retrench_control_agent.py

# produce live checkout traces
cd demo/agents && python3 checkout_agent.py

# Watchdog after a Fix decision
curl -X POST http://127.0.0.1:3000/api/agent/watchdog \
  -H 'content-type: application/json' \
  -d '{"featureId":"checkout-recovery"}'
```

Open `https://<alb>/agent` to see decisions, cliffs, briefs, Watchdog.

## Lambda rollup + agent tick

Code: [`lambda-rollup/`](./lambda-rollup/)

1. Zip `index.mjs` (handler `index.handler`, Node 20)
2. Env: `RETRENCH_BASE_URL=http://<alb-dns>`
3. EventBridge `rate(15 minutes)`
4. Memory 128–256 MB, timeout 30s

## Security groups

- ALB: 80/443 from internet (or hackathon CIDR)
- EC2: **3000 from ALB SG only**; SSH 22 from your IP
- Outbound HTTPS for neatlogs / Entire / cfo.ai / OpenRouter

## Cleanup

1. Delete EventBridge rule + Lambda  
2. Delete ALB + target group  
3. **Terminate** EC2  
4. Remove unused IAM roles if required  
