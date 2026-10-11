const AGENT = process.env.SCOUT_AGENT_URL?.replace(/\/$/, "") || "";
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
  signal_count: number;
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
  total: number;
  last_run_id?: string | null;
  last_run_status?: string | null;
  last_run_at?: string | null;
  categories: TargetCategory[];
  companies: TargetCompany[];
  error?: string;
};

function headers(): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (TOKEN) h["X-Scout-Token"] = TOKEN;
  return h;
}

export async function fetchTargets(): Promise<TargetsPayload> {
  if (!AGENT) {
    return {
      status: "failed",
      error: "SCOUT_AGENT_URL is not configured",
      total: 0,
      categories: [],
      companies: [],
    };
  }
  try {
    const res = await fetch(`${AGENT}/targets`, {
      headers: headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    const data = (await res.json()) as TargetsPayload;
    if (!res.ok) {
      return {
        status: "failed",
        error: data.error || `agent HTTP ${res.status}`,
        total: 0,
        categories: [],
        companies: [],
      };
    }
    return data;
  } catch {
    return {
      status: "failed",
      error: "Cannot reach scout agent for targets",
      total: 0,
      categories: [],
      companies: [],
    };
  }
}
