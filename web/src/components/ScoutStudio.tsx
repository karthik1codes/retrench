"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TEST_COMPANIES } from "@/data/test-companies";
import type {
  ContactRow,
  DraftRow,
  MatchedCompany,
  ScoutContext,
  ScoutedContent,
} from "@/lib/scout-agent";
import type { TargetCategory, TargetCompany } from "@/lib/targets";
import {
  gmailComposeUrl,
  mailtoUrl,
  outlookComposeUrl,
} from "@/lib/mail-compose";
import { cn } from "@/lib/utils";

const HOUR_MS = 60 * 60 * 1000;

function polishDraftText(text: string) {
  return text.replace(
    /(\d+\.\d{3,})\s*%/g,
    (_, n: string) => `${Number.parseFloat(n).toFixed(1)}%`,
  );
}

function parseDraft(body: string | null | undefined) {
  if (!body) return { subject: "", text: "" };
  const m = body.match(/^Subject:\s*(.+)\n\n([\s\S]*)$/i);
  if (m) {
    return {
      subject: polishDraftText(m[1].trim()),
      text: polishDraftText(m[2].trim()),
    };
  }
  const lines = body.split("\n");
  if (lines[0]?.toLowerCase().startsWith("subject:")) {
    return {
      subject: polishDraftText(lines[0].slice(8).trim()),
      text: polishDraftText(lines.slice(1).join("\n").trim()),
    };
  }
  return { subject: "Quick note", text: polishDraftText(body) };
}

function formatWhen(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function companyFacts(c?: MatchedCompany | null) {
  if (!c) return [];
  const facts: string[] = [];
  if (c.industry) facts.push(c.industry);
  else facts.push("Industry unknown");
  if (c.funding_stage) {
    facts.push(
      c.last_funding_amount
        ? `${c.funding_stage} · ${c.last_funding_amount}`
        : c.funding_stage,
    );
  }
  if (c.headcount != null && c.headcount !== "") {
    facts.push(`${c.headcount} employees`);
  } else if (c.employee_range) {
    facts.push(String(c.employee_range));
  }
  if (
    typeof c.headcount_growth_30d_pct === "number" &&
    c.headcount_growth_30d_pct !== 0
  ) {
    facts.push(`${c.headcount_growth_30d_pct}% headcount (30d)`);
  }
  if (c.country) facts.push(c.country);
  return facts;
}

function monthLabel(ym?: string | null) {
  if (!ym) {
    return new Date().toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });
  }
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ScoutStudio() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<DraftRow[]>([]);
  const [selected, setSelected] = useState<DraftRow | null>(null);
  const [matched, setMatched] = useState<MatchedCompany | null>(null);
  const [context, setContext] = useState<ScoutContext | null>(null);
  const { data: session } = useSession();
  const [to, setTo] = useState("");
  const [finding, setFinding] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [categories, setCategories] = useState<TargetCategory[]>([]);
  const [targetsMeta, setTargetsMeta] = useState<{
    total: number;
    windowDays?: number;
    lastRunAt?: string | null;
    generatedAt?: string;
    error?: string;
  }>({ total: 0 });
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [activeIndustry, setActiveIndustry] = useState<string>("all");

  const loadTargets = useCallback(async () => {
    try {
      const res = await fetch("/api/targets", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.status === "failed") {
        setTargetsMeta({
          total: 0,
          error: data.error || "Targets unavailable",
        });
        setCategories([]);
        return;
      }
      const cats: TargetCategory[] = data.categories || [];
      setCategories(cats);
      setTargetsMeta({
        total: data.total || 0,
        windowDays: data.window_days || 7,
        lastRunAt: data.last_run_at,
        generatedAt: data.generated_at,
      });
      setActiveIndustry((prev) => {
        if (prev === "all") return prev;
        return cats.some((c) => c.industry === prev) ? prev : "all";
      });
    } catch {
      setTargetsMeta({ total: 0, error: "Targets unavailable" });
      setCategories([]);
    } finally {
      setTargetsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTargets();
    const id = window.setInterval(() => void loadTargets(), HOUR_MS);
    return () => window.clearInterval(id);
  }, [loadTargets]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuery(q);
  }, [searchParams]);

  useEffect(() => {
    const parsed = parseDraft(selected?.draft_body);
    setSubject(parsed.subject);
    setBody(parsed.text);
  }, [selected?.signal_id, selected?.draft_id, selected?.draft_body]);

  const visibleCompanies: TargetCompany[] = useMemo(() => {
    if (activeIndustry === "all") {
      return categories.flatMap((c) => c.companies);
    }
    return (
      categories.find((c) => c.industry === activeIndustry)?.companies || []
    );
  }, [categories, activeIndustry]);

  async function runScout(override?: string) {
    const q = (override ?? query).trim();
    if (!q) {
      toast.error("Enter a company domain or name");
      return;
    }
    if (override) setQuery(override);
    setLoading(true);
    setStatus("Scouting…");
    setSelected(null);
    setContacts([]);
    setMatched(null);
    setContext(null);
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
          data.error?.includes("CrustData") || data.error?.includes("EC2")
            ? "Scout unavailable right now. Try again shortly."
            : data.error ||
                (res.status === 502
                  ? "Scout service unreachable. Try again shortly."
                  : "Scout failed"),
        );
      }
      const next: DraftRow[] = data.items || [];
      const company: MatchedCompany | null = data.matched_company || null;
      const ctx: ScoutContext | null = data.context || null;
      const safeCompany =
        company &&
        company.name &&
        String(company.name).toLowerCase() !== "none"
          ? company
          : company
            ? {
                ...company,
                name:
                  company.domain ||
                  (looksDomain ? q.toLowerCase() : q) ||
                  "Matched company",
              }
            : null;
      setItems(next);
      setMatched(safeCompany);
      setContext(ctx);
      setSelected(next.find((x) => x.draft_body) || next[0] || null);

      const monthCount =
        ctx?.signals_this_month ?? ctx?.signals_in_graph ?? next.length;
      if (data.demo) {
        setStatus("Sample results · run again when live scout is connected");
      } else if (monthCount > 0) {
        setStatus(
          `Done · ${monthCount} signal${monthCount === 1 ? "" : "s"} · ${
            safeCompany?.name || q
          }`,
        );
      } else {
        setStatus(
          ctx?.note ||
            `Done · profile saved for ${safeCompany?.name || q}`,
        );
      }

      toast.success(
        safeCompany?.name
          ? next.find((x) => x.draft_body)
            ? `Draft ready: ${safeCompany.name}`
            : `Scouted ${safeCompany.name}`
          : "Scout complete",
      );
      void loadTargets();
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
      matched?.domain ||
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
      if (data.demo) {
        toast.message(
          "Showing sample contacts — scout agent not reachable from this app",
        );
      }
      const firstEmail =
        rows
          .flatMap((c) => c.emails || [])
          .find((email) => email.endsWith(`@${domain}`)) ||
        rows.find((c) => c.emails?.[0])?.emails?.[0];
      if (firstEmail) {
        setTo(firstEmail);
        if (!data.demo) {
          toast.success(
            `${rows.length} contact${rows.length === 1 ? "" : "s"} found`,
          );
        }
      } else if (rows.length) {
        toast.message("People found — no business emails yet");
      } else {
        toast.message(
          data.error?.includes("CrustData") || data.error?.includes("permission")
            ? "No matching contacts with email yet"
            : data.error || "No matching decision-makers",
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Contact lookup failed";
      toast.error(
        msg.includes("CrustData") || msg.includes("permission")
          ? "Could not find contacts right now"
          : msg,
      );
    } finally {
      setFinding(false);
    }
  }

  function requireDraftReady() {
    if (!subject.trim() && !body.trim()) {
      toast.error("Draft is empty");
      return false;
    }
    if (!to.trim()) {
      toast.error("Add a recipient");
      return false;
    }
    return true;
  }

  function openInGmail() {
    if (!requireDraftReady()) return;
    window.open(
      gmailComposeUrl({
        to: to.trim(),
        subject: subject.trim() || "Quick note",
        body: body,
      }),
      "_blank",
      "noopener,noreferrer",
    );
    toast.success("Gmail compose opened");
  }

  function openInOutlook() {
    if (!requireDraftReady()) return;
    window.open(
      outlookComposeUrl({
        to: to.trim(),
        subject: subject.trim() || "Quick note",
        body: body,
      }),
      "_blank",
      "noopener,noreferrer",
    );
  }

  function openMailApp() {
    if (!requireDraftReady()) return;
    window.location.href = mailtoUrl({
      to: to.trim(),
      subject: subject.trim() || "Quick note",
      body: body,
    });
  }

  const facts = companyFacts(matched || context?.company);
  const scouted: ScoutedContent | undefined = context?.scouted;
  const signalContext = context?.signals?.length
    ? context.signals
    : items.map((i) => ({
        type: i.type || i.state,
        summary: i.summary,
        severity: i.severity,
        state: i.state,
        detected_at: i.detected_at,
        has_draft: Boolean(i.draft_body),
        confidence: i.confidence,
      }));
  const thisMonth = monthLabel(context?.month);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-8">
      <div className="mb-8 max-w-xl">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Company scout
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          The context changes your next send.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          Enter a company, get a trigger-backed draft, pick a contact, then open
          it in your mail
          {session?.user?.email ? ` as ${session.user.email}` : ""}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Target company</CardTitle>
              <CardDescription>
                Prefer a domain for the best match
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ramp.com"
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
            </CardContent>
          </Card>

          {(matched || context) && (
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {(() => {
                    const n =
                      matched?.name || context?.company?.name || query.trim();
                    return n && String(n).toLowerCase() !== "none"
                      ? n
                      : matched?.domain || query.trim() || "Matched company";
                  })()}
                </CardTitle>
                <CardDescription>
                  {[
                    matched?.domain || context?.company?.domain,
                    context?.note,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Live data from the scout agent"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {facts.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {facts.map((f) => (
                      <Badge key={f} variant="secondary">
                        {f}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Scouted content
                  </p>
                  {matched?.description || context?.company?.description ? (
                    <p className="mb-2 text-sm leading-relaxed text-foreground/90">
                      {matched?.description || context?.company?.description}
                    </p>
                  ) : null}
                  {scouted?.highlights?.length ? (
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {scouted.highlights
                        .filter(
                          (line) =>
                            !/matched none/i.test(line) &&
                            String(line).toLowerCase() !== "none",
                        )
                        .map((line) => (
                          <li
                            key={line}
                            className="rounded-md border border-border/70 px-3 py-2 text-foreground/90"
                          >
                            {line}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Company matched and saved. Open details appear as the
                      agent returns funding, headcount, and field data.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg border border-border px-2 py-2">
                    <p className="text-lg font-semibold tabular-nums">
                      {context?.signals_this_month ??
                        context?.signals_in_graph ??
                        items.length}
                    </p>
                    <p className="text-muted-foreground">This month</p>
                  </div>
                  <div className="rounded-lg border border-border px-2 py-2">
                    <p className="text-lg font-semibold tabular-nums">
                      {context?.signals_created ?? 0}
                    </p>
                    <p className="text-muted-foreground">New scout</p>
                  </div>
                  <div className="rounded-lg border border-border px-2 py-2">
                    <p className="text-lg font-semibold tabular-nums">
                      {context?.drafts_created ??
                        items.filter((i) => i.draft_body).length}
                    </p>
                    <p className="text-muted-foreground">Drafts</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Recent signals · {thisMonth}
                  </p>
                  {signalContext.length > 0 ? (
                    <ul className="space-y-2">
                      {signalContext.slice(0, 8).map((s, idx) => (
                        <li
                          key={`${s.type}-${idx}-${s.summary?.slice(0, 24)}`}
                          className="rounded-lg border border-border px-3 py-2 text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {s.type || "signal"}
                            </span>
                            {s.severity != null ? (
                              <Badge variant="outline">{s.severity}</Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm leading-snug">
                            {s.summary || "No summary"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[
                              s.state,
                              s.has_draft ? "draft ready" : null,
                              formatWhen(s.detected_at),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No recent signals for this company yet. Run scout again
                      after the agent stores a profile signal — a draft should
                      appear in the workspace when qualification succeeds.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    This week&apos;s draft companies
                  </CardTitle>
                  <CardDescription>
                    {targetsLoading
                      ? "Loading companies with drafts…"
                      : targetsMeta.total > 0
                        ? `${targetsMeta.total} with drafts in the last ${targetsMeta.windowDays || 7} days · refreshes hourly`
                        : "No drafts this week yet — seed list below until the cycle writes some"}
                  </CardDescription>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={targetsLoading}
                  onClick={() => {
                    setTargetsLoading(true);
                    void loadTargets();
                  }}
                >
                  Refresh
                </Button>
              </div>
              {targetsMeta.lastRunAt || targetsMeta.generatedAt ? (
                <p className="text-xs text-muted-foreground">
                  Instance{" "}
                  {formatWhen(targetsMeta.lastRunAt) ||
                    formatWhen(targetsMeta.generatedAt)}
                  {targetsMeta.error ? ` · ${targetsMeta.error}` : ""}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {categories.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="xs"
                      variant={activeIndustry === "all" ? "default" : "outline"}
                      onClick={() => setActiveIndustry("all")}
                    >
                      All ({targetsMeta.total})
                    </Button>
                    {categories.map((cat) => (
                      <Button
                        key={cat.industry}
                        size="xs"
                        variant={
                          activeIndustry === cat.industry
                            ? "default"
                            : "outline"
                        }
                        onClick={() => setActiveIndustry(cat.industry)}
                      >
                        {cat.industry} ({cat.count})
                      </Button>
                    ))}
                  </div>
                  <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                    {visibleCompanies.map((c) => (
                      <li key={`${c.domain}-${c.name}`}>
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left transition hover:bg-secondary/50"
                          onClick={() => {
                            const next = c.domain || c.name;
                            setQuery(next);
                            void runScout(next);
                          }}
                        >
                          <span>
                            <span className="block text-sm font-medium">
                              {c.name}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {[
                                c.domain,
                                c.funding_stage,
                                c.industry,
                                formatWhen(c.last_draft_at),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          <Badge variant="secondary">
                            {c.draft_count ?? 0} draft
                            {(c.draft_count ?? 0) === 1 ? "" : "s"}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {TEST_COMPANIES.slice(0, 12).map((c) => (
                    <Button
                      key={c.domain}
                      size="xs"
                      variant="outline"
                      title={c.note}
                      onClick={() => {
                        setQuery(c.domain);
                        void runScout(c.domain);
                      }}
                    >
                      {c.domain}
                    </Button>
                  ))}
                </div>
              )}
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
                  No draftable signals yet. Company context above still reflects
                  what the agent fetched.
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
              {selected?.domain || matched?.domain
                ? `${selected?.domain || matched?.domain}${
                    selected?.confidence != null
                      ? ` · confidence ${selected.confidence}`
                      : ""
                  }`
                : "Draft workspace"}
            </CardDescription>
            <CardTitle className="font-heading text-2xl">
              {selected?.company || matched?.name || "Waiting for a scout"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selected?.draft_body || subject || body ? (
              <Tabs defaultValue="draft">
                <TabsList className="mb-4">
                  <TabsTrigger value="draft">Draft</TabsTrigger>
                  <TabsTrigger value="send">Send</TabsTrigger>
                </TabsList>
                <TabsContent value="draft" className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="draft-subject"
                      className="text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      Subject
                    </Label>
                    <Input
                      id="draft-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Email subject"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="draft-body"
                      className="text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      Body
                    </Label>
                    <Textarea
                      id="draft-body"
                      className="min-h-52 font-sans"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write or edit your outreach…"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Edits apply to Copy and Open in Gmail / Outlook.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `${subject.trim()}\n\n${body}`,
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
                  <p className="text-xs text-muted-foreground">
                    Signed in as {session?.user?.email || "…"}. You choose the
                    recipient and send — Scout never sends for you.
                  </p>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
                Run a scout to load a draft for this company. Even with 0
                signals, the left panel shows the live company profile the agent
                fetched.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
