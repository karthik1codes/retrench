"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { ConnectMailDialog } from "@/components/ConnectMailDialog";
import type { DraftRow } from "@/lib/scout-agent";
import { loadMailSession, type MailSession } from "@/lib/mail-session";
import { DEMO_SIGNALS } from "@/data/signals";

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
  const [status, setStatus] = useState<string>("");
  const [items, setItems] = useState<DraftRow[]>([]);
  const [selected, setSelected] = useState<DraftRow | null>(null);
  const [to, setTo] = useState("");
  const [mail, setMail] = useState<MailSession | null>(null);
  const [sending, setSending] = useState(false);

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
      toast.error("Enter a SaaS company domain or name");
      return;
    }
    setLoading(true);
    setStatus("Firing scout on EC2…");
    setSelected(null);
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
        throw new Error(data.error || "Scout failed");
      }
      const next: DraftRow[] = data.items || [];
      setItems(next);
      setSelected(next.find((x) => x.draft_body) || next[0] || null);
      setStatus(
        data.demo
          ? "Demo mode (set SCOUT_AGENT_URL to hit EC2)"
          : `Done · ${data.credits_spent ?? 0} CrustData credits · ${data.run_id || ""}`,
      );
      toast.success(
        data.matched_company?.name
          ? `Draft ready for ${data.matched_company.name}`
          : "Scout complete",
      );
    } catch (e) {
      setStatus("");
      toast.error(e instanceof Error ? e.message : "Scout failed");
    } finally {
      setLoading(false);
    }
  }

  async function sendDraft() {
    const session = mail || loadMailSession();
    if (!session) {
      toast.error("Connect your email first");
      return;
    }
    if (!to.trim()) {
      toast.error("Add a recipient");
      return;
    }
    if (!selected?.draft_body) {
      toast.error("No draft to send");
      return;
    }
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
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Send failed");
      }
      toast.success("Draft sent from your mailbox");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-[100svh] bg-[var(--canvas)]">
      <header className="border-b border-[var(--line)] bg-[rgba(230,239,228,0.92)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 md:px-10">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-sm font-bold tracking-[0.18em] text-[var(--deep)]"
          >
            SIGNAL SCOUT
          </Link>
          <div className="flex items-center gap-2">
            <ConnectMailDialog onChange={setMail} />
            <Link
              href="/watchlist"
              className="inline-flex h-7 items-center rounded-lg px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              Watchlist
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-10 md:grid-cols-[1fr_1.05fr] md:px-10">
        <section className="space-y-6">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
              Scout any SaaS company
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
              Trigger the EC2 agent, pull live company signals, and retrieve an
              evidence-backed draft you can send from your own inbox.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Run on EC2</CardTitle>
              <CardDescription>
                Domain (stripe.com) or company name. Fires{" "}
                <code className="text-xs">signalscout scout</code> on your
                instance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="company-q">Company</Label>
                <Input
                  id="company-q"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="gallatin.ai or Gallatin AI"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runScout();
                  }}
                />
              </div>
              <Button
                className="w-full sm:w-auto"
                disabled={loading}
                onClick={() => void runScout()}
              >
                {loading ? "Scouting…" : "Trigger instance & get draft"}
              </Button>
              {status ? (
                <p className="text-xs text-muted-foreground">{status}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Results</CardTitle>
              <CardDescription>
                Pick a signal to review and send.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No results yet. Try a domain, or browse the{" "}
                  <Link href="/watchlist" className="underline">
                    weekly watchlist
                  </Link>
                  .
                </p>
              ) : (
                items.map((row) => (
                  <button
                    key={`${row.signal_id}-${row.draft_id}`}
                    type="button"
                    onClick={() => setSelected(row)}
                    className={`flex w-full flex-col gap-1 rounded-lg border px-3 py-3 text-left transition ${
                      selected?.signal_id === row.signal_id
                        ? "border-primary bg-accent/40"
                        : "border-border hover:bg-secondary/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{row.company}</span>
                      <Badge variant="secondary">{row.severity}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {row.summary}
                    </span>
                    <span className="text-xs font-medium text-primary">
                      {row.draft_body ? "Draft ready" : "No draft yet"}
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            {DEMO_SIGNALS.slice(0, 4).map((s) => (
              <Button
                key={s.id}
                size="sm"
                variant="outline"
                onClick={() => setQuery(s.domain)}
              >
                {s.domain}
              </Button>
            ))}
          </div>
        </section>

        <aside className="space-y-4 md:sticky md:top-8 md:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {selected?.company || "Draft"}
              </CardTitle>
              <CardDescription>
                {selected?.domain
                  ? `${selected.domain} · confidence ${selected.confidence ?? "—"}`
                  : "Trigger a scout to retrieve a company draft"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected?.draft_body ? (
                <>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Subject
                    </Label>
                    <p className="mt-1 font-medium">{draftParts.subject}</p>
                  </div>
                  <Textarea
                    className="min-h-56 font-[family-name:var(--font-body)]"
                    value={draftParts.text}
                    readOnly
                  />
                  <Separator />
                  <div className="grid gap-2">
                    <Label htmlFor="to">Send to</Label>
                    <Input
                      id="to"
                      type="email"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="founder@theircompany.com"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={sending}
                      onClick={() => void sendDraft()}
                    >
                      {sending ? "Sending…" : "Send from my email"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          `${draftParts.subject}\n\n${draftParts.text}`,
                        );
                        toast.success("Copied draft");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  {!mail ? (
                    <p className="text-xs text-muted-foreground">
                      Connect email (top right) before sending. Drafts never
                      auto-send.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Run a scout to pull live data and generate a draft for that
                  company.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
