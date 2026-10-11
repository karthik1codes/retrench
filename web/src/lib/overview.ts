import type { DraftRow } from "@/lib/scout-agent";

const AGENT = process.env.SCOUT_AGENT_URL?.replace(/\/$/, "") || "";
const TOKEN = process.env.SCOUT_API_TOKEN || "";

export type OverviewStats = {
  signals: number;
  drafts_ready: number;
  companies: number;
  last_run_id?: string | null;
  last_run_status?: string | null;
  last_run_credits?: number;
  last_run_at?: string | null;
};

export type ActivityPoint = {
  date: string;
  signals: number;
  drafts: number;
};

export type OverviewSignal = {
  id: string;
  type: string;
  summary: string;
  severity: number;
  state: string;
  detected_at?: string | null;
  company: string;
  domain: string;
  draft_id?: string | null;
  confidence?: number | null;
  has_draft: boolean;
};

export type OverviewPayload = {
  status: string;
  stats: OverviewStats;
  activity: ActivityPoint[];
  signals: OverviewSignal[];
  error?: string;
};

function headers(): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (TOKEN) h["X-Scout-Token"] = TOKEN;
  return h;
}

export async function fetchOverview(): Promise<OverviewPayload> {
  if (!AGENT) {
    return {
      status: "failed",
      error: "SCOUT_AGENT_URL is not configured",
      stats: { signals: 0, drafts_ready: 0, companies: 0 },
      activity: [],
      signals: [],
    };
  }
  try {
    const res = await fetch(`${AGENT}/overview`, {
      headers: headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    const data = (await res.json()) as OverviewPayload;
    if (!res.ok) {
      return {
        status: "failed",
        error: data.error || `agent HTTP ${res.status}`,
        stats: { signals: 0, drafts_ready: 0, companies: 0 },
        activity: [],
        signals: [],
      };
    }
    return data;
  } catch {
    return {
      status: "failed",
      error: "Cannot reach scout agent for overview",
      stats: { signals: 0, drafts_ready: 0, companies: 0 },
      activity: [],
      signals: [],
    };
  }
}

export async function fetchLiveWatchlist(): Promise<{
  status: string;
  signals: Array<{
    id: string;
    severity: number;
    company: string;
    domain: string;
    summary: string;
    why: string;
    draft?: { subject: string; body: string; confidence: number };
  }>;
  error?: string;
}> {
  if (!AGENT) {
    return { status: "failed", signals: [], error: "SCOUT_AGENT_URL is not configured" };
  }
  try {
    const res = await fetch(`${AGENT}/watchlist`, {
      headers: headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        status: "failed",
        signals: [],
        error: String(data.error || `agent HTTP ${res.status}`),
      };
    }
    return data;
  } catch {
    return {
      status: "failed",
      signals: [],
      error: "Cannot reach scout agent for watchlist",
    };
  }
}

/** Map overview signals into the scout draft row shape when needed. */
export function overviewToDraftRows(signals: OverviewSignal[]): DraftRow[] {
  return signals.map((s) => ({
    company: s.company,
    domain: s.domain,
    signal_id: s.id,
    summary: s.summary,
    severity: s.severity,
    state: s.state,
    draft_id: s.draft_id,
    draft_body: null,
    confidence: s.confidence,
  }));
}
