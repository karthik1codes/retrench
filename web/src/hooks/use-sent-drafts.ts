"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteSentDraft,
  loadSentDrafts,
  markGmailVerified,
  pendingFollowUps,
  type FollowUpStatus,
  type SentChannel,
  type SentDraft,
  updateFollowUpStatus,
  upsertSentDraft,
} from "@/lib/sent-drafts";

export function useSentDrafts() {
  const [drafts, setDrafts] = useState<SentDraft[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setDrafts(loadSentDrafts());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith("signal-scout:sent-drafts")) {
        refresh();
      }
    };
    const onCustom = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("signal-scout:sent-drafts", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("signal-scout:sent-drafts", onCustom);
    };
  }, [refresh]);

  const markSent = useCallback(
    (input: {
      company: string;
      domain: string;
      to: string;
      subject: string;
      body: string;
      signalSummary?: string;
      draftId?: string | null;
      signalId?: string | null;
      channel: SentChannel;
      gmailVerified?: boolean;
      gmailMessageId?: string | null;
      gmailThreadId?: string | null;
    }) => {
      const row = upsertSentDraft(input);
      refresh();
      return row;
    },
    [refresh],
  );

  const setFollowUp = useCallback(
    (sentId: string, followUpId: string, status: FollowUpStatus) => {
      setDrafts(updateFollowUpStatus(sentId, followUpId, status));
    },
    [],
  );

  const setGmailVerified = useCallback(
    (sentId: string, match: { id: string; threadId?: string }) => {
      setDrafts(markGmailVerified(sentId, match));
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setDrafts(deleteSentDraft(id));
  }, []);

  const followUps = pendingFollowUps(drafts);

  return {
    ready,
    drafts,
    followUps,
    markSent,
    setFollowUp,
    setGmailVerified,
    remove,
    refresh,
  };
}
