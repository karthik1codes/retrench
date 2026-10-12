import type { StyleObservation } from "@/lib/draft-memory";
import type { OutreachPrefs } from "@/lib/outreach-prefs";
import type { SentDraft } from "@/lib/sent-drafts";

export type UserDevice = {
  id: string;
  label?: string;
  userAgent?: string;
  lastSeenAt?: string;
};

export type UserProfile = {
  userId: string;
  email?: string;
  name?: string;
  version: number;
  updatedAt: string;
  outreachPrefs: OutreachPrefs;
  sentDrafts: SentDraft[];
  styleMemory: StyleObservation[];
  devices: UserDevice[];
};

export function emptyUserProfile(userId: string): UserProfile {
  return {
    userId,
    version: 0,
    updatedAt: new Date(0).toISOString(),
    outreachPrefs: { sendMode: "hitl", verifySent: true },
    sentDrafts: [],
    styleMemory: [],
    devices: [],
  };
}

const DEVICE_KEY = "signal-scout:device-id:v1";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `dev-${Date.now().toString(36)}`;
  }
}

export function devicePayload(): UserDevice {
  return {
    id: getOrCreateDeviceId(),
    label:
      typeof navigator !== "undefined"
        ? navigator.platform || "browser"
        : "unknown",
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 180) : "",
    lastSeenAt: new Date().toISOString(),
  };
}

/** Scope browser cache keys so shared machines don't mix users. */
export function userStorageKey(base: string, userKey?: string | null) {
  const k = (userKey || "anon").trim().toLowerCase() || "anon";
  return `${base}:${k}`;
}
