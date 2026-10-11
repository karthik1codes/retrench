"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConnectMailDialog } from "@/components/ConnectMailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_SIGNALS } from "@/data/signals";
import type { ContactRow, DraftRow } from "@/lib/scout-agent";
import {
  gmailComposeUrl,
  mailtoUrl,
  outlookComposeUrl,
} from "@/lib/mail-compose";
import { loadMailSession, type MailSession } from "@/lib/mail-session";
import { cn } from "@/lib/utils";

function parseDraft(body: string | null | undefined) {
  if (!body) return { subject: "", text: "" };
  const m = body.match(/^Subject:\s*(.+)\n\n([\s\S]*)$/i);
  if (m) return { subject: m[1].trim(), text: m[2].trim() };
  const lines = body.split("\n");
  if (lines[0]?.toLowerCase().startsWith("subject:")) {
    return {
      subject: lines[0].slice(8).trim(),
      text: lines.slice(1).join("\n").trim(),
    };
  }
  return { subject: "Quick note", text: body };
}

export function ScoutStudio() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<DraftRow[]>([]);
  const [selected, setSelected] = useState<DraftRow | null>(null);
  const [to, setTo] = useState("");
  const [mail, setMail] = useState<MailSession | null>(null);
  const [sending, setSending] = useState(false);
  const [finding, setFinding] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  const draftParts = useMemo(
    () => parseDraft(selected?.draft_body),
    [selected],
  );

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuery(q);
  }, [searchParams]);

  async function runScout() {
    const q = query.trim();
    if (!q) {
      toast.error("Enter a company domain or name");
      return;
    }
    setLoading(true);
    setStatus("Running on EC2…");
    setSelected(null);
    setContacts([]);
    try {
      const looksDomain = /^[\w.-]+\.[a-zA-Z]{2,}$/.test(q);
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          looksDomain ? { domain: q.toLowerCase() } : { name: q },
        ),
      });
      const data = await res.json();
      if (!res.ok || data.status === "failed") {
        throw new Error(
          data.error ||
            (res.status === 502
              ? "Cannot reach EC2 — check port 8787 or use an SSH tunnel"
              : "Scout failed"),
        );
      }
      const next: DraftRow[] = data.items || [];
      setItems(next);
      setSelected(next.find((x) => x.draft_body) || next[0] || null);
      setStatus(
        data.demo
          ? "Demo mode · connect EC2 for live CrustData"
          : `Complete · ${data.credits_spent ?? 0} credits`,
      );
      toast.success(
        data.matched_company?.name
          ? `Ready: ${data.matched_company.name}`
          : "Scout complete",
      );
    } catch (e) {
      setStatus("");
      toast.error(e instanceof Error ? e.message : "Scout failed");
    } finally {
      setLoading(false);
    }
  }

  async function findContacts() {
    const domain =
      selected?.domain ||
      (query.trim().match(/^[\w.-]+\.[a-zA-Z]{2,}$/)
        ? query.trim().toLowerCase()
        : "");
    if (!domain) {
      toast.error("Scout a company with a domain first");
      return;
    }
    setFinding(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, limit: 5 }),
      });
      const data = await res.json();
      if (!res.ok && data.status === "failed" && !data.contacts?.length) {
        throw new Error(data.error || "Contact lookup failed");
      }
      const rows: ContactRow[] = data.contacts || [];
      setContacts(rows);
      const firstEmail = rows.find((c) => c.emails?.[0])?.emails?.[0];
      if (firstEmail) {
        setTo(firstEmail);
        toast.success(
          data.demo
            ? `Demo contacts · ${domain}`
            : `${rows.length} people · ${data.credits_spent ?? 0} credits`,
        );
      } else if (rows.length) {
        toast.message("People found — no business emails yet");
      } else {
        toast.message(data.error || "No matching decision-makers");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Contact lookup failed");
    } finally {
      setFinding(false);
    }
  }

  function requireRecipient() {
    if (!to.trim()) {
      toast.error("Add a recipient");
      return false;
    }
    if (!selected?.draft_body) {
      toast.error("No draft selected");
      return false;
    }
    return true;
  }

  function openInGmail() {
    if (!requireRecipient()) return;
    window.open(
      gmailComposeUrl({
        to: to.trim(),
        subject: draftParts.subject,
        body: draftParts.text,
      }),
      "_blank",
      "noopener,noreferrer",
    );
    toast.success("Gmail compose opened");
  }

  function openInOutlook() {
    if (!requireRecipient()) return;
    window.open(
      outlookComposeUrl({
        to: to.trim(),
        subject: draftParts.subject,
        body: draftParts.text,
      }),
      "_blank",
      "noopener,noreferrer",
    );
  }

  function openMailApp() {
    if (!requireRecipient()) return;
    window.location.href = mailtoUrl({
      to: to.trim(),
      subject: draftParts.subject,
      body: draftParts.text,
    });
  }

  async function sendViaSmtp() {
    const session = mail || loadMailSession();
    if (!session) {
      toast.error("Connect email for SMTP, or use Open in Gmail");
      return;
    }
    if (!requireRecipient()) return;
    setSending(true);
    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: draftParts.subject,
          text: draftParts.text,
          email: session.email,
          from: session.email,
          appPassword: session.appPassword,
          provider: session.provider,
          smtpHost: session.smtpHost,
          smtpPort: session.smtpPort,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Send failed");
      toast.success("Sent via SMTP");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell showMail={false}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-12">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Company scout
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
              Find the signal. Draft. You send.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Trigger EC2 for any SaaS company, pull an evidence-backed draft,
              resolve a contact with CrustData, then open your mail.
            </p>
          </div>
          <ConnectMailDialog onChange={setMail} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Target company</CardTitle>
                <CardDescription>
                  Domain preferred · fires Signal Scout on your instance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="gallatin.ai"
                    className="sm:flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void runScout();
                    }}
                  />
                  <Button
                    disabled={loading}
                    onClick={() => void runScout()}
                    className="sm:min-w-36"
                  >
                    {loading ? "Scouting…" : "Run scout"}
                  </Button>
                </div>
                {status ? (
                  <p className="text-xs text-muted-foreground">{status}</p>
                ) : null}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {DEMO_SIGNALS.slice(0, 5).map((s) => (
                    <Button
                      key={s.id}
                      size="xs"
                      variant="outline"
                      onClick={() => setQuery(s.domain)}
                    >
                      {s.domain}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Signals</CardTitle>
                <CardDescription>
                  Select a result to review the draft
                </CardDescription>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                    No results yet. Run a scout to pull live triggers.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {items.map((row) => (
                      <li key={`${row.signal_id}-${row.draft_id}`}>
                        <button
                          type="button"
                          onClick={() => setSelected(row)}
                          className={cn(
                            "flex w-full flex-col gap-1 rounded-lg border px-3 py-3 text-left transition",
                            selected?.signal_id === row.signal_id
                              ? "border-primary bg-accent/25"
                              : "border-border hover:bg-secondary/50",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{row.company}</span>
                            <Badge variant="secondary">{row.severity}</Badge>
                          </div>
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {row.summary}
                          </span>
                          <span className="text-xs font-medium text-primary">
                            {row.draft_body ? "Draft ready" : "No draft"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-none lg:sticky lg:top-20 lg:self-start">
            <CardHeader>
              <CardDescription>
                {selected?.domain
                  ? `${selected.domain}${selected.confidence != null ? ` · confidence ${selected.confidence}` : ""}`
                  : "Draft workspace"}
              </CardDescription>
              <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
                {selected?.company || "Waiting for a scout"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selected?.draft_body ? (
                <Tabs defaultValue="draft">
                  <TabsList className="mb-4">
                    <TabsTrigger value="draft">Draft</TabsTrigger>
                    <TabsTrigger value="send">Send</TabsTrigger>
                  </TabsList>
                  <TabsContent value="draft" className="space-y-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Subject
                      </Label>
                      <p className="mt-1 font-medium">{draftParts.subject}</p>
                    </div>
                    <Textarea
                      className="min-h-52 font-[family-name:var(--font-body)]"
                      value={draftParts.text}
                      readOnly
                    />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          `${draftParts.subject}\n\n${draftParts.text}`,
                        );
                        toast.success("Copied");
                      }}
                    >
                      Copy draft
                    </Button>
                  </TabsContent>
                  <TabsContent value="send" className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="to">Recipient</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={finding}
                          onClick={() => void findContacts()}
                        >
                          {finding ? "Looking up…" : "Find contact"}
                        </Button>
                      </div>
                      <Input
                        id="to"
                        type="email"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        placeholder="name@company.com"
                      />
                    </div>

                    {contacts.length > 0 ? (
                      <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                        {contacts.map((c) => (
                          <li
                            key={`${c.name}-${c.title}-${c.emails[0] || ""}`}
                            className="text-sm"
                          >
                            <p className="font-medium">
                              {c.name}
                              {c.title ? (
                                <span className="font-normal text-muted-foreground">
                                  {" "}
                                  · {c.title}
                                </span>
                              ) : null}
                            </p>
                            {c.emails.length ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {c.emails.map((email) => (
                                  <Button
                                    key={email}
                                    size="xs"
                                    variant="secondary"
                                    onClick={() => {
                                      setTo(email);
                                      toast.success(`Selected ${email}`);
                                    }}
                                  >
                                    {email}
                                  </Button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                No business email
                                {c.profile_url ? (
                                  <>
                                    {" "}
                                    ·{" "}
                                    <a
                                      href={c.profile_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline"
                                    >
                                      profile
                                    </a>
                                  </>
                                ) : null}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <Separator />

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={openInGmail}>Open in Gmail</Button>
                      <Button variant="secondary" onClick={openInOutlook}>
                        Outlook
                      </Button>
                      <Button variant="outline" onClick={openMailApp}>
                        Mail app
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={sending}
                      onClick={() => void sendViaSmtp()}
                    >
                      {sending ? "Sending…" : "SMTP (advanced)"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Find contact uses CrustData. Open in Gmail uses your
                      account — Scout never auto-sends.
                    </p>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
                  Run a scout to load a draft for this company.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
