"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  scheduleProfilePush,
  setActiveUserKey,
  syncUserProfile,
} from "@/lib/user-profile-sync";

/**
 * Keeps prefs / sent drafts / style memory mirrored to the scout agent (Neo4j)
 * so the same Google user sees updates across devices. Parallel writes merge
 * by entity id on the agent.
 */
export function UserProfileSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") {
      setActiveUserKey(null);
      return;
    }
    const key =
      session?.user?.email?.trim().toLowerCase() ||
      session?.user?.id ||
      null;
    setActiveUserKey(key);
    if (!key) return;

    void syncUserProfile();

    const onDirty = () => scheduleProfilePush();
    const onFocus = () => {
      void syncUserProfile();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void syncUserProfile();
    };

    window.addEventListener("signal-scout:profile-dirty", onDirty);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const poll = window.setInterval(() => {
      void syncUserProfile();
    }, 20_000);

    return () => {
      window.removeEventListener("signal-scout:profile-dirty", onDirty);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(poll);
    };
  }, [session?.user?.email, session?.user?.id, status]);

  return null;
}
