#!/usr/bin/env bash
# Fetch SecureString params into /opt/signalscout/.env.runtime via instance role.
# Hackathon note: if SSM is not allowlisted, copy secrets manually to .env.local instead.
set -euo pipefail

PREFIX="${SSM_PREFIX:-/signalscout}"
REGION="${AWS_REGION:-us-east-1}"
OUT="${1:-/opt/signalscout/.env.runtime}"

fetch() {
  local name="$1"
  aws ssm get-parameter --region "$REGION" --name "${PREFIX}/${name}" --with-decryption \
    --query Parameter.Value --output text 2>/dev/null || true
}

{
  echo "CRUSTDATA_API_KEY=$(fetch CRUSTDATA_API_KEY)"
  echo "NEATLOGS_API_KEY=$(fetch NEATLOGS_API_KEY)"
  echo "OPENROUTER_API_KEY=$(fetch OPENROUTER_API_KEY)"
  echo "NEO4J_PASSWORD=$(fetch NEO4J_PASSWORD)"
  echo "SIGNAL_SCOUT_S3_BUCKET=$(fetch SIGNAL_SCOUT_S3_BUCKET)"
} >"$OUT"

chmod 600 "$OUT"
echo "Wrote $OUT"
