"""Fetch secrets from AWS SSM SecureString, with env fallback for local/dev."""

from __future__ import annotations

import os


def get_secret(name: str, env_key: str | None = None, default: str = "") -> str:
    env_key = env_key or name
    val = os.environ.get(env_key) or os.environ.get(name)
    if val:
        return val

    param = os.environ.get("SSM_PREFIX", "/signalscout") + "/" + name.lower()
    try:
        import boto3

        client = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        resp = client.get_parameter(Name=param, WithDecryption=True)
        return resp["Parameter"]["Value"]
    except Exception:
        return default
