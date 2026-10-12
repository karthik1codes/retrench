/** Style memory from HITL approve/edit/spam — LangChain GTM–style learning loop. */

export type StyleObservation = {
  id: string;
  at: string;
  kind: "approve" | "edit" | "spam_reject";
  company?: string;
  note: string;
  exampleSubject?: string;
  exampleSnippet?: string;
};

const KEY = "signal-scout:draft-memory:v1";
const MAX = 40;

function storageKey(userKey?: string | null) {
  const k = (userKey || "anon").trim().toLowerCase() || "anon";
  return `${KEY}:${k}`;
}

function uid() {
  return `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function loadStyleMemory(userKey?: string | null): StyleObservation[] {
  if (typeof window === "undefined") return [];
  try {
    const scoped = storageKey(userKey);
    let raw = window.localStorage.getItem(scoped);
    if (!raw) raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StyleObservation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStyleMemory(
  rows: StyleObservation[],
  userKey?: string | null,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    storageKey(userKey),
    JSON.stringify(rows.slice(0, MAX)),
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("signal-scout:profile-dirty"));
  }
}

export function rememberApproval(input: {
  company?: string;
  subject: string;
  body: string;
}) {
  const rows = loadStyleMemory();
  rows.unshift({
    id: uid(),
    at: new Date().toISOString(),
    kind: "approve",
    company: input.company,
    note: "Rep approved this draft — prefer similar tone, length, and specificity.",
    exampleSubject: input.subject,
    exampleSnippet: input.body.slice(0, 280),
  });
  saveStyleMemory(rows);
}

export function rememberEdit(input: {
  company?: string;
  beforeSubject: string;
  beforeBody: string;
  afterSubject: string;
  afterBody: string;
}) {
  const changedSubject = input.beforeSubject !== input.afterSubject;
  const beforeLen = input.beforeBody.trim().split(/\s+/).length;
  const afterLen = input.afterBody.trim().split(/\s+/).length;
  const noteParts = [
    changedSubject ? "Subject was edited." : null,
    afterLen < beforeLen
      ? "Rep shortened the body — prefer brevity."
      : afterLen > beforeLen
        ? "Rep expanded the body slightly."
        : "Body wording was refined.",
    "Match the revised voice on future drafts.",
  ].filter(Boolean);
  const rows = loadStyleMemory();
  rows.unshift({
    id: uid(),
    at: new Date().toISOString(),
    kind: "edit",
    company: input.company,
    note: noteParts.join(" "),
    exampleSubject: input.afterSubject,
    exampleSnippet: input.afterBody.slice(0, 280),
  });
  saveStyleMemory(rows);
}

export function rememberSpamReject(input: {
  company?: string;
  subject: string;
  body: string;
}) {
  const rows = loadStyleMemory();
  rows.unshift({
    id: uid(),
    at: new Date().toISOString(),
    kind: "spam_reject",
    company: input.company,
    note:
      "Rep flagged this as spammy. Avoid hype, urgency, vague pitches, ALL CAPS, links, and generic openers. Rewrite for Inbox.",
    exampleSubject: input.subject,
    exampleSnippet: input.body.slice(0, 200),
  });
  saveStyleMemory(rows);
}

export function styleNotesForPrompt(limit = 8): string[] {
  return loadStyleMemory()
    .slice(0, limit)
    .map((m) => {
      const ex = m.exampleSubject ? ` Example subject: "${m.exampleSubject}".` : "";
      return `${m.kind}: ${m.note}${ex}`;
    });
}
