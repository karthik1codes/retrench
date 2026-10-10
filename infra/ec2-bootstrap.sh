#!/usr/bin/env bash
# Amazon Linux 2023 — ONE hackathon EC2 (us-east-1 / Hackathon_VPC).
# Hosts: Next.js Retrench UI + autonomous control agent (test/run loop).
# Create web/.env.local on the instance yourself — never bake secrets into user-data.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/retrench}"
REPO_URL="${REPO_URL:-https://github.com/karthik1codes/retrench.git}"

sudo dnf update -y
sudo dnf install -y git nodejs npm python3 python3-pip

if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo mkdir -p "$(dirname "$APP_DIR")"
  sudo git clone "$REPO_URL" "$APP_DIR"
  sudo chown -R ec2-user:ec2-user "$APP_DIR"
fi

cd "$APP_DIR"
git pull --ff-only || true

cd "$APP_DIR/web"
if [[ ! -f .env.local ]]; then
  echo "Create $APP_DIR/web/.env.local before starting (see .env.example)." >&2
  exit 1
fi

npm ci
npm run build

# Optional Python deps for demo production agent (OpenRouter + neatlogs)
python3 -m pip install --user -r "$APP_DIR/demo/agents/requirements.txt" || true

# systemd — Next.js on :3000 (ALB target)
sudo tee /etc/systemd/system/retrench.service >/dev/null <<EOF
[Unit]
Description=Retrench Next.js control plane
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=$APP_DIR/web
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start -- -H 0.0.0.0 -p 3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# systemd — autonomous control agent (watch → decide → act → watchdog)
# Interval 60s for demos; pair with Lambda 15m tick in production-ish demos.
sudo tee /etc/systemd/system/retrench-agent.service >/dev/null <<EOF
[Unit]
Description=Retrench autonomous control agent
After=network.target retrench.service
Wants=retrench.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=$APP_DIR
Environment=RETRENCH_BASE_URL=http://127.0.0.1:3000
Environment=AGENT_TICK_SECONDS=60
ExecStart=/usr/bin/python3 $APP_DIR/demo/agents/retrench_control_agent.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now retrench.service
sudo systemctl enable --now retrench-agent.service
sudo systemctl status retrench.service --no-pager || true
sudo systemctl status retrench-agent.service --no-pager || true

echo ""
echo "ALB health: GET /api/health on :3000"
echo "Agent UI:   http://<alb>/agent"
echo "Manual tick: curl -X POST http://127.0.0.1:3000/api/agent/tick"
echo "Test agent once: AGENT_ONCE=1 python3 demo/agents/retrench_control_agent.py"
echo ""
echo "Note: Hackathon allows ONE EC2 — use this instance to run AND rehearse"
echo "(test) the control agent. No separate GPU/training fleet."
