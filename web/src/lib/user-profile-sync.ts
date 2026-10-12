"use client";

import {
  loadStyleMemory,
  saveStyleMemory,
  type StyleObservation,
} from "@/lib/draft-memory";
import {
  DEFAULT_OUTREACH_PREFS,
  loadOutreachPrefs,
  saveOutreachPrefs,
  type OutreachPrefs,
} from "@/lib/outreach-prefs";
import {
  loadSentDrafts,
  saveSentDrafts,
  type SentDraft,
} from "@/lib/sent-drafts";
import {
  devicePayload,
  emptyUserProfile,
  type UserProfile,
} from "@/lib/user-profile";

let activeUserKey: string | null = null;
let syncing = false;
let lastVersion = 0;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function setActiveUserKey(userKey: string | null) {
  activeUserKey = userKey;
}

export function getActiveUserKey() {
  return activeUserKey;
}

function applyProfileLocally(profile: UserProfile) {
  saveSentDrafts(profile.sentDrafts || [], activeUserKey);
  saveStyleMemory(profile.styleMemory || [], activeUserKey);
  saveOutreachPrefs(
    { ...DEFAULT_OUTREACH_PREFS, ...(profile.outreachPrefs || {}) },
    activeUserKey,
  );
  lastVersion = profile.version || 0;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("signal-scout:profile-synced", { detail: profile }),
    );
  }
}

export function buildLocalProfilePatch(userId: string): Partial<UserProfile> {
  return {
    userId,
    outreachPrefs: loadOutreachPrefs(activeUserKey),
    sentDrafts: loadSentDrafts(activeUserKey),
    styleMemory: loadStyleMemory(activeUserKey),
  };
}

export async function pullUserProfile(): Promise<UserProfile | null> {
  if (!activeUserKey) return null;
  try {
    const res = await fetch("/api/me/profile", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      profile?: UserProfile;
    };
    if (!data.profile) return null;
    applyProfileLocally(data.profile);
    return data.profile;
  } catch {
    return null;
  }
}

export async function pushUserProfile(
  patch?: Partial<UserProfile>,
): Promise<UserProfile | null> {
  if (!activeUserKey || syncing) return null;
  syncing = true;
  try {
    const body = {
      base_version: lastVersion,
      device: devicePayload(),
      profile: {
        ...buildLocalProfilePatch(activeUserKey),
        ...patch,
      },
    };
    const res = await fetch("/api/me/profile", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      profile?: UserProfile;
    };
    if (!data.profile) return null;
    applyProfileLocally(data.profile);
    return data.profile;
  } catch {
    return null;
  } finally {
    syncing = false;
  }
}

/** Pull then push so parallel device edits merge on the agent. */
export async function syncUserProfile(): Promise<UserProfile | null> {
  if (!activeUserKey) return null;
  const remote = await pullUserProfile();
  // After pull, local may have newer unsent rows — push merges both sides.
  const localDrafts = loadSentDrafts(activeUserKey);
  const localMem = loadStyleMemory(activeUserKey);
  const localPrefs = loadOutreachPrefs(activeUserKey);
  if (
    !remote ||
    localDrafts.length > 0 ||
    localMem.length > 0 ||
    localPrefs.askedAt
  ) {
    return pushUserProfile({
      sentDrafts: localDrafts,
      styleMemory: localMem,
      outreachPrefs: localPrefs,
    });
  }
  return remote || emptyUserProfile(activeUserKey);
}

export function scheduleProfilePush() {
  if (typeof window === "undefined" || !activeUserKey) return;
  if (pushTimer) window.clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushUserProfile();
  }, 400);
}

export type { OutreachPrefs, SentDraft, StyleObservation };
