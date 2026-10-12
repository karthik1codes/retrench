"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  hasChosenOutreachPrefs,
  loadOutreachPrefs,
  saveOutreachPrefs,
  type SendMode,
} from "@/lib/outreach-prefs";

type Props = {
  gmailConnected?: boolean;
};

export function OutreachPermissionDialog({ gmailConnected }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SendMode>("hitl");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasChosenOutreachPrefs()) {
      setMode(loadOutreachPrefs().sendMode);
      return;
    }
    setOpen(true);
  }, []);

  function choose(next: SendMode) {
    saveOutreachPrefs({
      sendMode: next,
      verifySent: true,
      askedAt: new Date().toISOString(),
    });
    setMode(next);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>How should Scout send mail?</DialogTitle>
          <DialogDescription>
            Choose once — you can change this later from the Send tab.
            {gmailConnected
              ? " Gmail is connected for Sent verification and send."
              : " Sign in with Google again if Sent verify / agent send fails."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setMode("hitl")}
            className={`rounded-lg border px-3 py-2.5 text-left transition ${
              mode === "hitl"
                ? "border-primary bg-accent/30"
                : "border-border hover:bg-secondary/40"
            }`}
          >
            <p className="text-sm font-medium">Human in the loop</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              You send from Gmail. Scout polls Sent to confirm delivery and
              queues +3d / +7d follow-ups for you to send.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode("agent")}
            className={`rounded-lg border px-3 py-2.5 text-left transition ${
              mode === "agent"
                ? "border-primary bg-accent/30"
                : "border-border hover:bg-secondary/40"
            }`}
          >
            <p className="text-sm font-medium">Agent may send</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              After you Approve a draft, Scout can send via Gmail and keep up
              overdue follow-ups automatically.
            </p>
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => choose("hitl")}>
            Stay human-in-loop
          </Button>
          <Button onClick={() => choose(mode)}>Save preference</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
