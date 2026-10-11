import { DEMO_SIGNALS } from "@/data/signals";

const AGENT = process.env.SCOUT_AGENT_URL?.replace(/\/$/, "") || "";
const TOKEN = process.env.SCOUT_API_TOKEN || "";
const FALLBACK =
  process.env.SCOUT_FALLBACK_DEMO === "1" ||
  process.env.SCOUT_FALLBACK_DEMO === "true";

export type MatchedCompany = {
  name?: string;
  domain?: string;
  industry?: string;
  headcount?: number | string | null;
  funding_stage?: string | null;
  last_funding_date?: string | null;
  last_funding_amount?: string | null;
  headcount_growth_30d_pct?: number | null;
  country?: string | null;
};

export type ScoutSignalContext = {
  type?: string;
  summary?: string;
  severity?: number;
  state?: string;
  detected_at?: string | null;
  has_draft?: boolean;
  confidence?: number | null;
};

export type ScoutContext = {
  company?: MatchedCompany;
  signals_created?: number;
  drafts_created?: number;
  signals_in_graph?: number;
  note?: string;
  signals?: ScoutSignalContext[];
};

export type ScoutResult = {
  status: string;
  run_id?: string;
  drafts?: string[];
  matched_company?: MatchedCompany;
  context?: ScoutContext;
  credits_spent?: number;
  error?: string;
  demo?: boolean;
  items?: DraftRow[];
};

export type DraftRow = {
  company: string;
  domain: string;
  industry?: string;
  signal_id: string;
  type?: string;
  summary: string;
  severity: number;
  state: string;
  detected_at?: string | null;
  draft_id?: string | null;
  draft_body?: string | null;
  confidence?: number | null;
};

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (TOKEN) h["X-Scout-Token"] = TOKEN;
  return h;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text.slice(0, 200) || `HTTP ${res.status}` };
  }
}

export async function triggerScout(input: {
  domain?: string;
  name?: string;
}): Promise<ScoutResult> {
  if (!AGENT) {
    return demoScout(input);
  }

  try {
    const res = await fetch(`${AGENT}/scout`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(180_000),
    });
    const raw = await readJson(res);
    const data = raw as ScoutResult;
    if (!res.ok) {
      data.status = data.status || "failed";
      data.error =
        (typeof data.error === "string" && data.error) ||
        `agent HTTP ${res.status}`;
    }
    return data;
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.name === "TimeoutError"
          ? "Scout timed out. Try again shortly."
          : "Scout service unreachable. Try again shortly."
        : "Scout service unreachable. Try again shortly.";
    if (FALLBACK) {
      const demo = demoScout(input);
      demo.error = msg;
      return demo;
    }
    return { status: "failed", error: msg };
  }
}

export async function fetchDrafts(company: string): Promise<{
  company: string;
  items: DraftRow[];
  demo?: boolean;
  error?: string;
}> {
  if (!AGENT) {
    return demoDrafts(company);
  }

  try {
    const res = await fetch(
      `${AGENT}/drafts?company=${encodeURIComponent(company)}`,
      {
        headers: headers(),
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      },
    );
    const data = await readJson(res);
    if (!res.ok) {
      if (FALLBACK) return { ...demoDrafts(company), error: String(data.error || res.status) };
      return {
        company,
        items: [],
        error: String(data.error || `agent HTTP ${res.status}`),
      };
    }
    return data as { company: string; items: DraftRow[]; demo?: boolean };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "drafts fetch failed";
    if (FALLBACK) return { ...demoDrafts(company), error: msg };
    return { company, items: [], error: msg };
  }
}

function demoScout(input: { domain?: string; name?: string }): ScoutResult {
  const q = (input.domain || input.name || "").toLowerCase();
  const hit =
    DEMO_SIGNALS.find(
      (s) =>
        s.domain.includes(q) ||
        s.company.toLowerCase().includes(q) ||
        q.includes(s.domain.split(".")[0]),
    ) || DEMO_SIGNALS[0];
  return {
    status: "complete",
    demo: true,
    run_id: "demo-local",
    drafts: hit.draft ? [`demo-${hit.id}`] : [],
    matched_company: { name: hit.company, domain: hit.domain },
    credits_spent: 0,
    items: [
      {
        company: hit.company,
        domain: hit.domain,
        signal_id: hit.id,
        summary: hit.summary,
        severity: hit.severity,
        state: hit.draft ? "drafted" : "qualified",
        draft_id: hit.draft ? `demo-${hit.id}` : null,
        draft_body: hit.draft
          ? `Subject: ${hit.draft.subject}\n\n${hit.draft.body}`
          : null,
        confidence: hit.draft?.confidence ?? null,
      },
    ],
  };
}

export type ContactRow = {
  name: string;
  title: string;
  profile_url?: string | null;
  emails: string[];
};

export async function findContacts(input: {
  domain: string;
  titles?: string[];
  verified?: boolean;
  limit?: number;
}): Promise<{
  status: string;
  domain?: string;
  contacts: ContactRow[];
  credits_spent?: number;
  error?: string;
  demo?: boolean;
}> {
  if (!AGENT) {
    return demoContacts(input.domain);
  }
  try {
    const res = await fetch(`${AGENT}/contacts`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
    const data = await readJson(res);
    if (!res.ok) {
      const err = String(data.error || `agent HTTP ${res.status}`);
      if (FALLBACK) {
        return { ...demoContacts(input.domain), error: err };
      }
      return {
        status: "failed",
        domain: input.domain,
        contacts: [],
        error: err,
      };
    }
    return {
      ...(data as {
        status: string;
        domain?: string;
        contacts: ContactRow[];
        credits_spent?: number;
        error?: string;
      }),
      demo: false,
    };
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "TimeoutError"
        ? "Contact lookup timed out"
        : "Cannot reach scout agent for contacts";
    if (FALLBACK) return { ...demoContacts(input.domain), error: msg };
    return {
      status: "failed",
      domain: input.domain,
      contacts: [],
      error: msg,
    };
  }
}

function demoContacts(domain: string) {
  const hit =
    DEMO_SIGNALS.find((s) => s.domain.includes(domain.toLowerCase())) ||
    DEMO_SIGNALS[0];
  const local = domain.split(".")[0] || "company";
  return {
    status: "complete" as const,
    demo: true,
    domain: hit.domain,
    credits_spent: 0,
    contacts: [
      {
        name: "Alex Rivera",
        title: "VP Sales",
        profile_url: null,
        emails: [`alex.rivera@${hit.domain}`],
      },
      {
        name: "Sam Chen",
        title: "CRO",
        profile_url: null,
        emails: [`sam.chen@${local}.example`],
      },
    ],
  };
}

function demoDrafts(company: string) {
  const q = company.toLowerCase();
  const items = DEMO_SIGNALS.filter(
    (s) =>
      s.domain.includes(q) ||
      s.company.toLowerCase().includes(q) ||
      q.includes(s.domain.split(".")[0]),
  ).map((hit) => ({
    company: hit.company,
    domain: hit.domain,
    signal_id: hit.id,
    summary: hit.summary,
    severity: hit.severity,
    state: hit.draft ? "drafted" : "qualified",
    draft_id: hit.draft ? `demo-${hit.id}` : null,
    draft_body: hit.draft
      ? `Subject: ${hit.draft.subject}\n\n${hit.draft.body}`
      : null,
    confidence: hit.draft?.confidence ?? null,
  }));
  return { company, items, demo: true };
}
