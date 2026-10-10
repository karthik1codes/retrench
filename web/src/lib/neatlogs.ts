import { env } from "./config";

const BASE = () => env("NEATLOGS_BASE_URL", "https://app.neatlogs.com");

export type NeatlogsTraceSummary = {
  id: string;
  name?: string;
  status?: string;
  createdAt?: string;
  workflowName?: string;
};

/**
 * Public API read credential.
 * Prefer NEATLOGS_TOKEN (service-account). Ingest keys (nlw_/project keys)
 * cannot authorize GET /api/v1/public/traces.
 */
export function getNeatlogsReadToken(): string {
  return (
    env("NEATLOGS_TOKEN") ||
    env("NEATLOGS_SERVICE_ACCOUNT_TOKEN") ||
    env("NEATLOGS_API_KEY") ||
    env("NEATLOGS_PROJECT_API_KEY")
  );
}

export function hasNeatlogsCreds() {
  return Boolean(getNeatlogsReadToken());
}

export function hasNeatlogsServiceToken() {
  return Boolean(env("NEATLOGS_TOKEN") || env("NEATLOGS_SERVICE_ACCOUNT_TOKEN"));
}

export function hasNeatlogsIngestKey() {
  return Boolean(env("NEATLOGS_API_KEY") || env("NEATLOGS_PROJECT_API_KEY"));
}

function mapTrace(t: Record<string, unknown>): NeatlogsTraceSummary {
  return {
    id: String(t.id ?? t.traceId ?? t.trace_id ?? ""),
    name: t.name
      ? String(t.name)
      : t.workflowName
        ? String(t.workflowName)
        : t.workflow_name
          ? String(t.workflow_name)
          : undefined,
    status: t.status ? String(t.status) : undefined,
    createdAt: t.createdAt
      ? String(t.createdAt)
      : t.created_at
        ? String(t.created_at)
        : undefined,
    workflowName: t.workflowName
      ? String(t.workflowName)
      : t.workflow_name
        ? String(t.workflow_name)
        : t.name
          ? String(t.name)
          : undefined,
  };
}

async function neatlogsFetch(path: string) {
  const token = getNeatlogsReadToken();
  const projectId = env("NEATLOGS_PROJECT_ID");
  if (!token) {
    throw new Error(
      "Missing NEATLOGS_TOKEN (service-account) or NEATLOGS_API_KEY"
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (projectId) headers["x-project-id"] = projectId;

  const res = await fetch(`${BASE()}${path}`, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 && !hasNeatlogsServiceToken()) {
      throw new Error(
        "neatlogs 401: ingest/project API key cannot read Public API. " +
          "Set NEATLOGS_TOKEN (service-account, observability:read) in web/.env.local. " +
          `Raw: ${body.slice(0, 160)}`
      );
    }
    throw new Error(`neatlogs ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** Runtime truth — list recent traces (same list as app.neatlogs.com). */
export async function listTraces(limit = 10): Promise<NeatlogsTraceSummary[]> {
  const json = await neatlogsFetch(`/api/v1/public/traces?limit=${limit}`);
  const traces = json?.data?.traces ?? json?.traces ?? json?.data ?? [];
  const list = Array.isArray(traces) ? traces : [];
  return list.map((t: Record<string, unknown>) => mapTrace(t));
}

/** Traces for a Retrench feature / neatlogs workflow name. */
export async function listFeatureTraces(
  workflowHint: string,
  limit = 20
): Promise<NeatlogsTraceSummary[]> {
  const all = await listTraces(limit);
  const needle = workflowHint.toLowerCase().replace(/_/g, "-");
  const filtered = all.filter((t) => {
    const hay = `${t.name ?? ""} ${t.workflowName ?? ""}`.toLowerCase();
    return (
      hay.includes(needle) ||
      hay.includes(needle.replace(/-/g, "_")) ||
      hay.includes("checkout")
    );
  });
  return filtered.length ? filtered : all;
}

export async function getTrace(traceId: string) {
  return neatlogsFetch(`/api/v1/public/traces/${encodeURIComponent(traceId)}`);
}

export async function getProject() {
  return neatlogsFetch(`/api/v1/public/project`);
}
