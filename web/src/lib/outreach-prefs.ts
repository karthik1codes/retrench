export type SendMode = "hitl" | "agent";

export type OutreachPrefs = {
  /** hitl = human sends in Gmail; agent = Scout may send via Gmail API after approve */
  sendMode: SendMode;
  /** Poll Gmail Sent after compose to confirm delivery */
  verifySent: boolean;
  askedAt?: string;
};

const KEY = "signal-scout:outreach-prefs:v1";

export const DEFAULT_OUTREACH_PREFS: OutreachPrefs = {
  sendMode: "hitl",
  verifySent: true,
};

export function loadOutreachPrefs(): OutreachPrefs {
  if (typeof window === "undefined") return DEFAULT_OUTREACH_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_OUTREACH_PREFS;
    return { ...DEFAULT_OUTREACH_PREFS, ...(JSON.parse(raw) as OutreachPrefs) };
  } catch {
    return DEFAULT_OUTREACH_PREFS;
  }
}

export function saveOutreachPrefs(prefs: OutreachPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    KEY,
    JSON.stringify({ ...prefs, askedAt: prefs.askedAt || new Date().toISOString() }),
  );
  window.dispatchEvent(new Event("signal-scout:outreach-prefs"));
}

export function hasChosenOutreachPrefs(): boolean {
  const p = loadOutreachPrefs();
  return Boolean(p.askedAt);
}
