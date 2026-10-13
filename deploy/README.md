# Signal Scout — Deploy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

## Elevator pitch

Deploy assets for running Signal Scout unattended on a single EC2 (or any Linux) host: Neo4j + agent via Docker Compose, systemd timers for hourly cycles, optional SSM secret bootstrap, and an IAM policy sketch. The Next.js UI is typically hosted on Vercel and points at this host’s `:8787` API.

## Key features

- **`docker-compose.yml`** — Neo4j 5 + agent image build from [`Dockerfile`](./Dockerfile)
- **systemd units** — oneshot cycle timer, digest helper, HTTP API service
- **`ssm_bootstrap.sh`** — fetch SecureString params into `/opt/signalscout/.env.runtime`
- **`iam-policy.json`** — SSM / S3 / Session Manager permissions sketch
- **Local Neo4j** — same compose file for developer machines

## Architecture / how it works

```text
┌─────────────────────────────────────────────┐
│ EC2 /opt/signalscout                        │
│  docker compose: neo4j :7687 + agent        │
│  systemd: signal-scout.timer → run cycle    │
│  systemd: signal-scout-api → :8787 serve    │
│  .env.local / .env.runtime                  │
└──────────────────┬──────────────────────────┘
                   │ TCP 8787 (SG)
                   ▼
         Vercel web (SCOUT_AGENT_URL)
```

Hackathon allowlist note: EC2, Lambda, IAM, ALB are typically allowed; Docker on the instance is fine. If S3/SSM/CloudWatch are blocked, put secrets in `.env.local` on disk and keep evidence under local `credits/`.

## Prerequisites & requirements

| Requirement | Notes |
| --- | --- |
| Linux host | Ubuntu common; `ec2-user` or equivalent |
| Docker + Compose plugin | For Neo4j (+ optional agent container) |
| Python 3.11+ | If running agent via systemd `ExecStart` on host |
| Security group | Inbound TCP **8787** from Vercel / your IP as needed |
| Secrets | CrustData, OpenRouter, Neo4j password, `SCOUT_API_TOKEN` |

## Installation & quickstart

### Local Neo4j only

```bash
# From repo root
docker compose -f deploy/docker-compose.yml up -d neo4j
# NEO4J_URI=bolt://localhost:7687  NEO4J_PASSWORD=signalscout
```

### EC2 (host install sketch)

```bash
# After clone to /opt/signalscout
cd /opt/signalscout
sudo bash deploy/ssm_bootstrap.sh          # or copy .env.local manually
docker compose -f deploy/docker-compose.yml up -d neo4j
sudo cp deploy/systemd/* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now signal-scout.timer
sudo systemctl enable --now signal-scout-api
sudo systemctl start signal-scout.service
```

Prefer **SSM Session Manager** over open SSH when possible.

## Configuration

| Name | Default | Description |
| --- | --- | --- |
| `NEO4J_URI` | `bolt://neo4j:7687` (compose) / `bolt://localhost:7687` (host) | Graph bolt URL |
| `NEO4J_USER` | `neo4j` | Neo4j user |
| `NEO4J_PASSWORD` | `signalscout` | Matches compose `NEO4J_AUTH` |
| `SCOUT_API_TOKEN` | `change-me` | API auth; must match Vercel / web |
| `AWS_REGION` | `us-east-1` | Region for SSM/S3 |
| `SSM_PREFIX` | `/signalscout` | Parameter path prefix for `ssm_bootstrap.sh` |
| `SIGNAL_SCOUT_S3_BUCKET` | _(empty)_ | Optional evidence bucket |

Compose loads optional `../.env.local`. systemd units load `/opt/signalscout/.env.local` and/or `.env.runtime` (see unit files under [`systemd/`](./systemd)).

| Unit | Role |
| --- | --- |
| `signal-scout.timer` | Schedule oneshot cycle |
| `signal-scout.service` | One full `run` cycle |
| `signal-scout-api.service` | `python -m signalscout serve --host 0.0.0.0 --port 8787` |
| `signal-scout-digest.service` | Digest helper oneshot |

## Usage examples

```bash
# Health from the host
curl -s http://127.0.0.1:8787/health

# From your laptop (SG must allow)
curl -s -H "X-Scout-Token: change-me" \
  "http://YOUR_EC2_IP:8787/targets?days=7"

# Manual cycle
sudo systemctl start signal-scout.service
journalctl -u signal-scout.service -n 100 --no-pager
```

Point Vercel `SCOUT_AGENT_URL` at `http://YOUR_EC2_PUBLIC_IP:8787` (see [`web/VERCEL_DEPLOY.md`](../web/VERCEL_DEPLOY.md)).

## Testing

```bash
docker compose -f deploy/docker-compose.yml ps
curl -sf http://127.0.0.1:8787/health
sudo systemctl status signal-scout.timer signal-scout-api --no-pager
```

Agent logic tests remain at repo root: `NEO4J_URI=memory pytest -q`.

## Contributing

1. Change compose/systemd in this folder; keep host paths (`/opt/signalscout`) documented
2. Do not commit `.env.local` or `.env.runtime`
3. Align `SCOUT_API_TOKEN` docs with root and `web/` READMEs
4. Test timer + API on a throwaway instance before changing production SG rules

## License & acknowledgments

MIT — see [../LICENSE](../LICENSE).

Uses Neo4j Community, Docker, and AWS IAM/SSM patterns suitable for neatHack EC2 deploys. Application acknowledgments (CrustData, neatlogs, Entire, cfo.ai) are in the [root README](../README.md).
