/** Client-side sent-draft + follow-up store (HITL after compose). */

export type FollowUpStatus = "pending" | "sent" | "skipped";

export type FollowUp = {
  id: string;
  dayOffset: number;
  dueAt: string;
  subject: string;
  body: string;
  status: FollowUpStatus;
  /** Short label: bump | close */
  purpose?: string;
};

export type SentChannel =
  | "gmail"
  | "gmail_api"
  | "outlook"
  | "mailto"
  | "manual";

export type SentDraft = {
  id: string;
  company: string;
  domain: string;
  to: string;
  subject: string;
  body: string;
  signalSummary?: string;
  draftId?: string | null;
  signalId?: string | null;
  channel: SentChannel;
  sentAt: string;
  followUps: FollowUp[];
  /** Confirmed present in Gmail Sent via API poll */
  gmailVerified?: boolean;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
};

const STORAGE_KEY = "signal-scout:sent-drafts:v1";

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function cleanTrigger(signalSummary?: string) {
  const raw = (signalSummary || "").trim();
  if (!raw) return null;
  return raw
    .replace(/\b(CrustData|enrichment|scraper|live company profile)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function threadSubject(subject: string) {
  const base = subject.replace(/^Re:\s*/i, "").trim() || "Quick note";
  return `Re: ${base}`;
}

/**
 * After a send is approved/stored, queue a short follow-up sequence
 * (day +3 bump, day +7 close) for optional enrollment — human still reviews.
 */
export function buildFollowUps(input: {
  company: string;
  subject: string;
  signalSummary?: string;
  sentAt: string;
  originalBody?: string;
}): FollowUp[] {
  const company = (input.company || "there").trim() || "there";
  const trigger = cleanTrigger(input.signalSummary);
  const hook = trigger || `what ${company} has been working on`;
  const subject = threadSubject(input.subject);

  return [
    {
      id: uid("fu"),
      dayOffset: 3,
      dueAt: addDays(input.sentAt, 3),
      purpose: "bump",
      subject,
      body: [
        "Hi,",
        "",
        `Wanted to bump my note on ${hook}.`,
        "If useful, happy to share a short peer example — otherwise I'll leave it here.",
        "",
        "Best",
      ].join("\n"),
      status: "pending",
    },
    {
      id: uid("fu"),
      dayOffset: 7,
      dueAt: addDays(input.sentAt, 7),
      purpose: "close",
      subject,
      body: [
        "Hi,",
        "",
        `Last note from me on ${hook}.`,
        "If timing is off, no worries — glad to reconnect whenever it makes sense.",
        "",
        "Best",
      ].join("\n"),
      status: "pending",
    },
  ];
}

export function loadSentDrafts(): SentDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SentDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSentDrafts(rows: SentDraft[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event("signal-scout:sent-drafts"));
}

export function upsertSentDraft(
  draft: Omit<SentDraft, "id" | "sentAt" | "followUps"> & {
    id?: string;
    sentAt?: string;
    followUps?: FollowUp[];
    gmailVerified?: boolean;
    gmailMessageId?: string | null;
    gmailThreadId?: string | null;
  },
): SentDraft {
  const sentAt = draft.sentAt || new Date().toISOString();
  const row: SentDraft = {
    id: draft.id || uid("sent"),
    company: draft.company,
    domain: draft.domain,
    to: draft.to,
    subject: draft.subject,
    body: draft.body,
    signalSummary: draft.signalSummary,
    draftId: draft.draftId,
    signalId: draft.signalId,
    channel: draft.channel,
    sentAt,
    followUps:
      draft.followUps ||
      buildFollowUps({
        company: draft.company,
        subject: draft.subject,
        signalSummary: draft.signalSummary,
        sentAt,
        originalBody: draft.body,
      }),
    gmailVerified: draft.gmailVerified,
    gmailMessageId: draft.gmailMessageId,
    gmailThreadId: draft.gmailThreadId,
  };
  const existing = loadSentDrafts();
  const next = [row, ...existing.filter((d) => d.id !== row.id)];
  saveSentDrafts(next);
  return row;
}

/** Refresh pending follow-up copy for a sent row (keeps sent/skipped). */
export function regeneratePendingFollowUps(sentId: string): SentDraft[] {
  const next = loadSentDrafts().map((d) => {
    if (d.id !== sentId) return d;
    const fresh = buildFollowUps({
      company: d.company,
      subject: d.subject,
      signalSummary: d.signalSummary,
      sentAt: d.sentAt,
      originalBody: d.body,
    });
    const kept = d.followUps.filter((f) => f.status !== "pending");
    return { ...d, followUps: [...kept, ...fresh] };
  });
  saveSentDrafts(next);
  return next;
}

export function updateFollowUpStatus(
  sentId: string,
  followUpId: string,
  status: FollowUpStatus,
): SentDraft[] {
  const next = loadSentDrafts().map((d) => {
    if (d.id !== sentId) return d;
    return {
      ...d,
      followUps: d.followUps.map((f) =>
        f.id === followUpId ? { ...f, status } : f,
      ),
    };
  });
  saveSentDrafts(next);
  return next;
}

export function markGmailVerified(
  sentId: string,
  match: { id: string; threadId?: string },
): SentDraft[] {
  const next = loadSentDrafts().map((d) => {
    if (d.id !== sentId) return d;
    return {
      ...d,
      gmailVerified: true,
      gmailMessageId: match.id,
      gmailThreadId: match.threadId || d.gmailThreadId,
    };
  });
  saveSentDrafts(next);
  return next;
}

export function deleteSentDraft(id: string): SentDraft[] {
  const next = loadSentDrafts().filter((d) => d.id !== id);
  saveSentDrafts(next);
  return next;
}

export function pendingFollowUps(rows: SentDraft[]) {
  const now = Date.now();
  return rows.flatMap((d) =>
    d.followUps
      .filter((f) => f.status === "pending")
      .map((f) => ({
        ...f,
        sentId: d.id,
        company: d.company,
        domain: d.domain,
        to: d.to,
        overdue: new Date(f.dueAt).getTime() <= now,
      })),
  );
}
