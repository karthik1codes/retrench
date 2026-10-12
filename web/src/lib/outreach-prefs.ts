export type SendMode = "hitl" | "agent";

export type OutreachPrefs = {
  /** hitl = human sends in Gmail; agent = Scout may send via Gmail API after approve */
  sendMode: SendMode;
  /** Poll Gmail Sent after compose to confirm delivery */
  verifySent: boolean;
  askedAt?: string;
};

const KEY = "signal-scout:outreach-prefs:v1";

function storageKey(userKey?: string | null) {
  const k = (userKey || "anon").trim().toLowerCase() || "anon";
  return `${KEY}:${k}`;
}

export const DEFAULT_OUTREACH_PREFS: OutreachPrefs = {
  sendMode: "hitl",
  verifySent: true,
};

export function loadOutreachPrefs(userKey?: string | null): OutreachPrefs {
  if (typeof window === "undefined") return DEFAULT_OUTREACH_PREFS;
  try {
    const scoped = storageKey(userKey);
    let raw = window.localStorage.getItem(scoped);
    if (!raw) raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_OUTREACH_PREFS;
    return { ...DEFAULT_OUTREACH_PREFS, ...(JSON.parse(raw) as OutreachPrefs) };
  } catch {
    return DEFAULT_OUTREACH_PREFS;
  }
}

export function saveOutreachPrefs(
  prefs: OutreachPrefs,
  userKey?: string | null,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    storageKey(userKey),
    JSON.stringify({
      ...prefs,
      askedAt: prefs.askedAt || new Date().toISOString(),
    }),
  );
  window.dispatchEvent(new Event("signal-scout:outreach-prefs"));
  window.dispatchEvent(new Event("signal-scout:profile-dirty"));
}

export function hasChosenOutreachPrefs(userKey?: string | null): boolean {
  const p = loadOutreachPrefs(userKey);
  return Boolean(p.askedAt);
}
