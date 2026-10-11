"""Evidence payloads in S3 (or local fallback). Graph only stores s3_key + hash."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from signalscout.graph import payload_hash


class EvidenceStore:
    def __init__(self, bucket: str | None = None, local_root: str | Path | None = None):
        self.bucket = bucket or os.environ.get("SIGNAL_SCOUT_S3_BUCKET", "")
        self.local_root = Path(
            local_root or os.environ.get("SIGNAL_SCOUT_EVIDENCE_DIR", "credits/evidence")
        )
        self.local_root.mkdir(parents=True, exist_ok=True)

    def put(self, key: str, payload: Any, source: str = "crustdata") -> tuple[str, str]:
        body = json.dumps(payload, indent=2, default=str).encode("utf-8")
        ph = payload_hash(payload)
        s3_key = key if key.startswith("s3://") else f"s3://{self.bucket}/{key}" if self.bucket else f"local://{key}"

        # always write local copy for hackathon resilience
        local_path = self.local_root / key.replace("/", "_")
        local_path.write_bytes(body)

        if self.bucket:
            try:
                import boto3

                boto3.client("s3").put_object(
                    Bucket=self.bucket,
                    Key=key,
                    Body=body,
                    ContentType="application/json",
                    Metadata={"source": source, "payload_hash": ph},
                )
            except Exception:
                # local fallback still valid
                s3_key = f"local://{key}"

        return s3_key, ph
