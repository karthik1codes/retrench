"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { useSentDrafts } from "@/hooks/use-sent-drafts";
import { loadOutreachPrefs } from "@/lib/outreach-prefs";
import {
  gmailComposeUrl,
  mailtoUrl,
  outlookComposeUrl,
} from "@/lib/mail-compose";
import { cn } from "@/lib/utils";

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type SentDraftsStudioProps = {
  initialTab?: "sent" | "follow-ups";
};

export function SentDraftsStudio({
  initialTab = "sent",
}: SentDraftsStudioProps) {
  const { data: session } = useSession();
  const { ready, drafts, followUps, setFollowUp, remove } = useSentDrafts();
  const [tab, setTab] = useState(initialTab);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const autoRan = useRef(false);
  const prefs = loadOutreachPrefs();
  const agentMode = prefs.sendMode === "agent";

  const selected = useMemo(
    () => drafts.find((d) => d.id === selectedId) || drafts[0] || null,
    [drafts, selectedId],
  );

  async function agentSendFollowUp(
    sentId: string,
    followUpId: string,
    to: string,
    subject: string,
    body: string,
  ) {
    setAgentBusy(true);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        throw new Error(data.error || "Follow-up send failed");
      }
      setFollowUp(sentId, followUpId, "sent");
      toast.success("Follow-up sent via Gmail");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Follow-up send failed");
    } finally {
      setAgentBusy(false);
    }
  }

  useEffect(() => {
    if (!ready || !agentMode || autoRan.current) return;
    const overdue = followUps.filter((f) => f.overdue);
    if (!overdue.length) return;
    if (!session?.gmailConnected) return;
    autoRan.current = true;
    void (async () => {
      for (const f of overdue.slice(0, 3)) {
        await agentSendFollowUp(f.sentId, f.id, f.to, f.subject, f.body);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot agent keep-up
  }, [ready, agentMode, followUps, session?.gmailConnected]);

  function openFollowUp(
    channel: "gmail" | "outlook" | "mailto",
    sentId: string,
    followUpId: string,
    to: string,
    subject: string,
    body: string,
  ) {
    if (channel === "gmail") {
      window.open(
        gmailComposeUrl({ to, subject, body }),
        "_blank",
        "noopener,noreferrer",
      );
    } else if (channel === "outlook") {
      window.open(
        outlookComposeUrl({ to, subject, body }),
        "_blank",
        "noopener,noreferrer",
      );
    } else {
      window.location.href = mailtoUrl({ to, subject, body });
    }
    setFollowUp(sentId, followUpId, "sent");
    toast.success("Follow-up opened — marked sent");
  }

  if (!ready) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading sent drafts…</div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Sent & follow-ups</h1>
        <p className="text-sm text-muted-foreground">
          Sent store + +3d / +7d follow-ups
          {agentMode
            ? " · agent mode keeps overdue follow-ups when Gmail is connected"
            : " · human-in-the-loop (open mail yourself)"}
          . Pattern inspired by{" "}
          <a
            href="https://www.langchain.com/blog/how-we-built-langchains-gtm-agent"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            LangChain&apos;s GTM agent
          </a>
          .
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (v === "sent" || v === "follow-ups") setTab(v);
        }}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="sent">
            Sent ({drafts.length})
          </TabsTrigger>
          <TabsTrigger value="follow-ups">
            Follow-ups ({followUps.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sent" className="mt-0">
          {drafts.length === 0 ? (
            <Card size="sm" className="shadow-none">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No sent drafts yet. From Scout, open Gmail or use Agent send
                after Approve.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
              <Card size="sm" className="shadow-none">
                <CardHeader className="border-b py-2.5">
                  <CardTitle>Stored sends</CardTitle>
                  <CardDescription>
                    Local to this browser · contact history for do-not-spam
                  </CardDescription>
                </CardHeader>
                <CardContent className="max-h-[min(70vh,36rem)] overflow-y-auto px-0 py-2">
                  <ul className="flex flex-col gap-1.5 px-(--card-spacing)">
                    {drafts.map((d) => {
                      const pending = d.followUps.filter(
                        (f) => f.status === "pending",
                      ).length;
                      const active = selected?.id === d.id;
                      return (
                        <li key={d.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(d.id)}
                            className={cn(
                              "flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition",
                              active
                                ? "border-primary bg-accent/25"
                                : "border-border hover:bg-secondary/40",
                            )}
                          >
                            <CompanyAvatar
                              name={d.company}
                              domain={d.domain}
                              size="sm"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {d.company}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {d.to} · {formatWhen(d.sentAt)}
                              </span>
                            </span>
                            {pending > 0 ? (
                              <Badge variant="secondary">{pending} fu</Badge>
                            ) : (
                              <Badge variant="outline">Done</Badge>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>

              {selected ? (
                <Card size="sm" className="shadow-none">
                  <CardHeader className="border-b py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate">
                          {selected.subject}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {selected.to} · via {selected.channel}
                          {selected.gmailVerified ? " · Sent verified" : ""} ·{" "}
                          {formatWhen(selected.sentAt)}
                        </CardDescription>
                      </div>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          remove(selected.id);
                          setSelectedId(null);
                          toast.message("Removed from sent store");
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex max-h-[min(70vh,36rem)] flex-col gap-4 overflow-y-auto py-3">
                    {selected.signalSummary ? (
                      <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          Why it was sent
                        </p>
                        <p className="mt-1 text-sm">{selected.signalSummary}</p>
                      </div>
                    ) : null}
                    <div>
                      <p className="text-xs text-muted-foreground">Body</p>
                      <pre className="mt-1 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                        {selected.body}
                      </pre>
                    </div>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-medium">Follow-ups</p>
                      {selected.followUps.map((f) => (
                        <div
                          key={f.id}
                          className="rounded-lg border border-border px-3 py-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                              Day +{f.dayOffset} · {formatWhen(f.dueAt)}
                            </p>
                            <Badge
                              variant={
                                f.status === "pending"
                                  ? "default"
                                  : f.status === "sent"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {f.status}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {f.subject}
                          </p>
                          {f.status === "pending" ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {agentMode ? (
                                <Button
                                  size="xs"
                                  disabled={agentBusy}
                                  onClick={() =>
                                    void agentSendFollowUp(
                                      selected.id,
                                      f.id,
                                      selected.to,
                                      f.subject,
                                      f.body,
                                    )
                                  }
                                >
                                  {agentBusy ? "Sending…" : "Agent send"}
                                </Button>
                              ) : null}
                              <Button
                                size="xs"
                                variant={agentMode ? "secondary" : "default"}
                                onClick={() =>
                                  openFollowUp(
                                    "gmail",
                                    selected.id,
                                    f.id,
                                    selected.to,
                                    f.subject,
                                    f.body,
                                  )
                                }
                              >
                                Open Gmail
                              </Button>
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={() =>
                                  openFollowUp(
                                    "outlook",
                                    selected.id,
                                    f.id,
                                    selected.to,
                                    f.subject,
                                    f.body,
                                  )
                                }
                              >
                                Outlook
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => {
                                  setFollowUp(selected.id, f.id, "skipped");
                                  toast.message("Follow-up skipped");
                                }}
                              >
                                Skip
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}
        </TabsContent>

        <TabsContent value="follow-ups" className="mt-0">
          {followUps.length === 0 ? (
            <Card size="sm" className="shadow-none">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No pending follow-ups. Save a sent draft from Scout to enqueue
                day +3 and day +7 nudges.
              </CardContent>
            </Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {followUps.map((f) => (
                <li key={`${f.sentId}-${f.id}`}>
                  <Card size="sm" className="shadow-none">
                    <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{f.company}</p>
                          <Badge variant={f.overdue ? "destructive" : "secondary"}>
                            {f.overdue ? "Due" : `Day +${f.dayOffset}`}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatWhen(f.dueAt)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm">{f.subject}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          To {f.to}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        {agentMode ? (
                          <Button
                            size="sm"
                            disabled={agentBusy}
                            onClick={() =>
                              void agentSendFollowUp(
                                f.sentId,
                                f.id,
                                f.to,
                                f.subject,
                                f.body,
                              )
                            }
                          >
                            {agentBusy ? "Sending…" : "Agent send"}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant={agentMode ? "secondary" : "default"}
                          onClick={() =>
                            openFollowUp(
                              "gmail",
                              f.sentId,
                              f.id,
                              f.to,
                              f.subject,
                              f.body,
                            )
                          }
                        >
                          Open Gmail
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setFollowUp(f.sentId, f.id, "skipped");
                            toast.message("Skipped");
                          }}
                        >
                          Skip
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setTab("sent");
                            setSelectedId(f.sentId);
                          }}
                        >
                          View thread
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}
