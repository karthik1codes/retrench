/** Client-side sent-draft + follow-up store (LangChain GTM–style HITL after compose). */

export type FollowUpStatus = "pending" | "sent" | "skipped";

export type FollowUp = {
  id: string;
  dayOffset: number;
  dueAt: string;
  subject: string;
  body: string;
  status: FollowUpStatus;
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

/** Queue +3d / +7d follow-ups after a send — same idea as LangChain GTM enroll-after-approve. */
export function buildFollowUps(input: {
  company: string;
  subject: string;
  signalSummary?: string;
  sentAt: string;
}): FollowUp[] {
  const trigger =
    (input.signalSummary || "").trim() ||
    "your recent company update";
  const firstNameHint = input.company.split(/\s+/)[0] || "there";

  return [
    {
      id: uid("fu"),
      dayOffset: 3,
      dueAt: addDays(input.sentAt, 3),
      subject: `Re: ${input.subject.replace(/^Re:\s*/i, "")}`,
      body: `Hi,\n\nCircling back briefly on ${firstNameHint} — happy to share a short note tied to ${trigger} if useful this week.\n\nBest`,
      status: "pending",
    },
    {
      id: uid("fu"),
      dayOffset: 7,
      dueAt: addDays(input.sentAt, 7),
      subject: `Quick follow-up — ${input.company}`,
      body: `Hi,\n\nOne last nudge on the note about ${trigger}. If timing is off, no worries — glad to reconnect later.\n\nBest`,
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
