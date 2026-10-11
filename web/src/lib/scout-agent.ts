import { DEMO_SIGNALS } from "@/data/signals";

const AGENT = process.env.SCOUT_AGENT_URL?.replace(/\/$/, "") || "";
const TOKEN = process.env.SCOUT_API_TOKEN || "";

export type ScoutResult = {
  status: string;
  run_id?: string;
  drafts?: string[];
  matched_company?: { name?: string; domain?: string };
  credits_spent?: number;
  error?: string;
  demo?: boolean;
  items?: DraftRow[];
};

export type DraftRow = {
  company: string;
  domain: string;
  signal_id: string;
  summary: string;
  severity: number;
  state: string;
  draft_id?: string | null;
  draft_body?: string | null;
  confidence?: number | null;
};

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (TOKEN) h["X-Scout-Token"] = TOKEN;
  return h;
}

export async function triggerScout(input: {
  domain?: string;
  name?: string;
}): Promise<ScoutResult> {
  if (!AGENT) {
    return demoScout(input);
  }
  const res = await fetch(`${AGENT}/scout`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const data = (await res.json()) as ScoutResult;
  if (!res.ok && !data.error) {
    data.error = `agent HTTP ${res.status}`;
    data.status = data.status || "failed";
  }
  return data;
}

export async function fetchDrafts(company: string): Promise<{
  company: string;
  items: DraftRow[];
  demo?: boolean;
}> {
  if (!AGENT) {
    return demoDrafts(company);
  }
  const res = await fetch(
    `${AGENT}/drafts?company=${encodeURIComponent(company)}`,
    { headers: headers(), cache: "no-store" },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `agent HTTP ${res.status}`);
  }
  return data;
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
