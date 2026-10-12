import { getScoutAgentUrl } from "@/lib/agent-url";

const AGENT = getScoutAgentUrl();
const TOKEN = process.env.SCOUT_API_TOKEN || "";

export type TargetCompany = {
  name: string;
  domain: string;
  industry: string;
  headcount?: number | string | null;
  funding_stage?: string | null;
  last_funding_date?: string | null;
  last_funding_amount?: string | null;
  headcount_growth_30d_pct?: number | null;
  country?: string | null;
  draft_count?: number;
  signal_count: number;
  last_draft_at?: string | null;
  last_signal_at?: string | null;
  updated_at?: string | null;
};

export type TargetCategory = {
  industry: string;
  count: number;
  companies: TargetCompany[];
};

export type TargetsPayload = {
  status: string;
  generated_at?: string;
  refresh_interval_hours?: number;
  window_days?: number;
  window_since?: string;
  source?: string;
  total: number;
  last_run_id?: string | null;
  last_run_status?: string | null;
  last_run_at?: string | null;
  categories: TargetCategory[];
  companies: TargetCompany[];
  error?: string;
};

function emptyTargets(error: string): TargetsPayload {
  return {
    status: "unavailable",
    error,
    total: 0,
    categories: [],
    companies: [],
    window_days: 7,
    refresh_interval_hours: 1,
  };
}

function headers(): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (TOKEN) h["X-Scout-Token"] = TOKEN;
  return h;
}

export async function fetchTargets(): Promise<TargetsPayload> {
  if (!AGENT) {
    return emptyTargets("SCOUT_AGENT_URL is not configured");
  }
  try {
    const res = await fetch(`${AGENT}/targets?days=7`, {
      headers: headers(),
      cache: "no-store",
      // Fail fast so Scout UI does not hang ~10–60s when EC2 is down
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await res.json()) as TargetsPayload;
    if (!res.ok) {
      return emptyTargets(data.error || `agent HTTP ${res.status}`);
    }
    return {
      ...data,
      status: data.status || "complete",
      total: data.total ?? data.companies?.length ?? 0,
      categories: data.categories || [],
      companies: data.companies || [],
    };
  } catch (e) {
    const timedOut =
      e instanceof Error &&
      (e.name === "TimeoutError" || e.name === "AbortError");
    return emptyTargets(
      timedOut
        ? "Scout agent timed out — check EC2 :8787 is up and SG allows your IP"
        : "Cannot reach scout agent for targets — start signal-scout-api on EC2",
    );
  }
}
