"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { ScoutFlowStepper } from "@/components/ScoutFlowStepper";
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

function companyWebsite(domain?: string | null) {
  if (!domain) return null;
  const host = domain.replace(/^https?:\/\//i, "").split("/")[0];
  if (!host) return null;
  return {
    host,
    href: `https://${host}`,
  };
}

function companyLogoSrc(
  domain?: string | null,
  logoUrl?: string | null,
): string | null {
  if (logoUrl && /^https?:\/\//i.test(logoUrl)) return logoUrl;
  const host = companyWebsite(domain)?.host;
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

function companyInitials(name?: string | null, domain?: string | null) {
  const source = (name || domain || "?").trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function companyFacts(c?: MatchedCompany | null) {
  if (!c) return [];
  const facts: string[] = [];
  if (c.industry) facts.push(c.industry);
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

function overviewRows(c?: MatchedCompany | null) {
  if (!c) return [] as { label: string; value: string }[];
  const rows: { label: string; value: string }[] = [];
  if (c.industry) rows.push({ label: "Industry", value: c.industry });
  if (c.funding_stage || c.last_funding_amount) {
    rows.push({
      label: "Funding",
      value: [c.funding_stage, c.last_funding_amount, c.last_funding_date]
        .filter(Boolean)
        .join(" · "),
    });
  }
  if (c.headcount != null && c.headcount !== "") {
    const growth =
      typeof c.headcount_growth_30d_pct === "number"
        ? ` (${c.headcount_growth_30d_pct > 0 ? "+" : ""}${c.headcount_growth_30d_pct}% / 30d)`
        : "";
    rows.push({ label: "Headcount", value: `${c.headcount}${growth}` });
  } else if (c.employee_range) {
    rows.push({ label: "Size", value: String(c.employee_range) });
  }
  if (c.country) rows.push({ label: "HQ", value: c.country });
  return rows;
}

function scrubVendorMeta(text: string) {
  return text
    .replace(/\blive company profile from CrustData\b/gi, "")
    .replace(/\bfrom CrustData\b/gi, "")
    .replace(/\bCrustData\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s:;|.-]+|[\s:;|.-]+$/g, "")
    .trim();
}

function parseSignalText(summary?: string | null, implication?: string | null) {
  let trigger = scrubVendorMeta((summary || "").trim());
  let why = scrubVendorMeta((implication || "").trim());
  const marker = /\|?\s*Why it matters:\s*/i;
  if (!why && marker.test(trigger)) {
    const parts = trigger.split(marker);
    trigger = scrubVendorMeta((parts[0] || "").trim());
    why = scrubVendorMeta((parts[1] || "").trim());
  }
  // Drop "Company (domain):" / "snapshot:" prefix noise when redundant
  trigger =
    trigger
      .replace(/^[^:]+\([^)]+\):\s*/i, "")
      .replace(/^[^:]+\s+snapshot:\s*/i, "")
      .trim() || trigger;
  if (!trigger) trigger = "Company snapshot";
  // Drop implication that only talks about data vendors / profile availability
  if (
    why &&
    /online presence|readiness for engagement|data (vendor|source)|enrichment/i.test(
      why,
    )
  ) {
    why = "";
  }
  return { trigger, why };
}

function pickBestDraft(rows: DraftRow[]) {
  const withDraft = rows.filter((r) => r.draft_body);
  const prefer = withDraft.find(
    (r) => r.type && !["profile", "signal"].includes(String(r.type)),
  );
  return prefer || withDraft[0] || rows[0] || null;
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
  const [hitlBusy, setHitlBusy] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState("draft");
  const [composeOpened, setComposeOpened] = useState(false);
  const [draftApproved, setDraftApproved] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState<number | null>(null);

  async function recordHitl(
    action: "approve" | "edit" | "reject",
    opts?: { silent?: boolean },
  ) {
    setHitlBusy(true);
    try {
      const res = await fetch("/api/draft-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          draft_id: selected?.draft_id,
          signal_id: selected?.signal_id,
          company: selected?.company || matched?.name || query.trim(),
          domain: selected?.domain || matched?.domain || query.trim(),
          subject,
          body,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!opts?.silent) {
        if (data.logged) {
          toast.success(
            action === "approve"
              ? "Approved — logged to neatlogs"
              : action === "reject"
                ? "Rejected — logged"
                : "Edit logged",
          );
        } else if (action === "approve") {
          toast.success("Approved");
        } else if (action === "reject") {
          toast.message("Rejected");
        }
      }
    } catch {
      if (!opts?.silent) toast.error("Could not log HITL action");
    } finally {
      setHitlBusy(false);
    }
  }

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
    setDraftApproved(false);
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
    setCreditsSpent(null);
    setDraftApproved(false);
    setComposeOpened(false);
    setWorkspaceTab("draft");
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
      setCreditsSpent(
        typeof data.credits_spent === "number" ? data.credits_spent : null,
      );
      setSelected(pickBestDraft(next));

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
    setComposeOpened(true);
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
    setComposeOpened(true);
  }

  function openMailApp() {
    if (!requireDraftReady()) return;
    setComposeOpened(true);
    window.location.href = mailtoUrl({
      to: to.trim(),
      subject: subject.trim() || "Quick note",
      body: body,
    });
  }

  const company = matched || context?.company || null;
  const facts = companyFacts(company);
  const rows = overviewRows(company);
  const site = companyWebsite(company?.domain || query.trim());
  const logoSrc = companyLogoSrc(
    company?.domain || query.trim(),
    company?.logo_url,
  );
  const scouted: ScoutedContent | undefined = context?.scouted;
  const thisMonth = monthLabel(context?.month);
  const companyTitle = (() => {
    const n = company?.name || query.trim();
    return n && String(n).toLowerCase() !== "none"
      ? n
      : site?.host || "Matched company";
  })();
  const draftItems = useMemo(
    () => items.filter((i) => Boolean(i.draft_body)),
    [items],
  );
  const draftIndex = draftItems.findIndex(
    (d) =>
      d.draft_id === selected?.draft_id ||
      d.signal_id === selected?.signal_id,
  );
  const activeDraftIndex = draftIndex >= 0 ? draftIndex : 0;

  function selectDraftByOffset(delta: number) {
    if (draftItems.length === 0) return;
    const base = draftIndex >= 0 ? draftIndex : 0;
    const next = (base + delta + draftItems.length) % draftItems.length;
    setSelected(draftItems[next] || null);
    setWorkspaceTab("draft");
  }

  const flowStep = (() => {
    if (composeOpened) return 5;
    if (workspaceTab === "send" || to.trim()) return 3;
    if (selected?.draft_body || subject || body) return 2;
    if (loading || matched || context) return 1;
    return 1;
  })();

  function handleFlowStep(step: number) {
    if (step <= 1) {
      setWorkspaceTab("draft");
      return;
    }
    if (step === 2) {
      setWorkspaceTab("draft");
      return;
    }
    if (step >= 3) {
      if (!selected?.draft_body && !subject.trim() && !body.trim()) {
        toast.message("Pick a signal with a draft first");
        return;
      }
      setWorkspaceTab("send");
    }
  }

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

      <Card className="mb-6 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Scout progress</CardTitle>
          <CardDescription>
            Compact steps — company stays visible; slide drafts in the workspace
            only
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ScoutFlowStepper
            current={flowStep}
            searching={loading}
            onStepChange={handleFlowStep}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="flex flex-col gap-4">
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Target company</CardTitle>
              <CardDescription>
                Prefer a domain for the best match
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
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
                <div className="flex items-start gap-3">
                  <Avatar
                    size="lg"
                    className="size-12 rounded-lg after:rounded-lg"
                  >
                    {logoSrc ? (
                      <AvatarImage
                        src={logoSrc}
                        alt=""
                        className="rounded-lg object-contain p-1"
                      />
                    ) : null}
                    <AvatarFallback className="rounded-lg text-sm font-semibold">
                      {companyInitials(companyTitle, site?.host)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base leading-tight">
                      {companyTitle}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {site ? (
                        <a
                          href={site.href}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {site.host}
                        </a>
                      ) : (
                        context?.note || "Live company overview"
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Company info
                  </p>
                  {rows.length > 0 ? (
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      {rows.map((row) => (
                        <div key={row.label} className="min-w-0">
                          <dt className="text-xs text-muted-foreground">
                            {row.label}
                          </dt>
                          <dd className="truncate font-medium">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : facts.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {facts.map((f) => (
                        <Badge key={f} variant="secondary">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {company?.description ? (
                    <p className="line-clamp-3 text-sm leading-relaxed text-foreground/90">
                      {company.description}
                    </p>
                  ) : !rows.length && !facts.length ? (
                    <p className="text-sm text-muted-foreground">
                      Profile saved. Industry, funding, and headcount appear
                      when the source returns them.
                    </p>
                  ) : null}
                  {scouted?.fetched_at ? (
                    <p className="text-xs text-muted-foreground">
                      Fetched {formatWhen(scouted.fetched_at)}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg border border-border px-2 py-2">
                    <p className="text-lg font-semibold tabular-nums">
                      {context?.signals_this_month ??
                        context?.signals_in_graph ??
                        items.length}
                    </p>
                    <p className="text-muted-foreground">Recent</p>
                  </div>
                  <div className="rounded-lg border border-border px-2 py-2">
                    <p className="text-lg font-semibold tabular-nums">
                      {context?.signals_created ?? 0}
                    </p>
                    <p className="text-muted-foreground">New scout</p>
                  </div>
                  <div className="rounded-lg border border-border px-2 py-2">
                    <p className="text-lg font-semibold tabular-nums">
                      {context?.drafts_created ?? draftItems.length}
                    </p>
                    <p className="text-muted-foreground">Drafts</p>
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Recent signals · {thisMonth}
                  </p>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Select a signal to open its draft — use Prev/Next in the
                    workspace to slide drafts only
                    {(context?.suppressed_count ?? 0) > 0
                      ? ` · ${context?.suppressed_count} skipped (do-not-contact)`
                      : ""}
                  </p>
                  {items.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {items.map((row, idx) => {
                        const parsed = parseSignalText(
                          row.summary,
                          row.implication,
                        );
                        const whyShort =
                          parsed.why && parsed.why.length > 160
                            ? `${parsed.why.slice(0, 157).trim()}…`
                            : parsed.why;
                        const active = selected?.signal_id === row.signal_id;
                        return (
                          <li key={`${row.signal_id}-${row.draft_id ?? idx}`}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelected(row);
                                if (row.draft_body) setWorkspaceTab("draft");
                              }}
                              className={cn(
                                "flex w-full flex-col gap-2 rounded-lg border px-3 py-3 text-left transition",
                                active
                                  ? "border-primary bg-accent/25"
                                  : "border-border hover:bg-secondary/40",
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {(row.type === "profile"
                                    ? "snapshot"
                                    : row.type || "signal"
                                  ).replace(/_/g, " ")}
                                </span>
                                <Badge variant="outline">{row.severity}</Badge>
                              </div>
                              <p className="text-sm font-medium leading-snug">
                                {parsed.trigger || "Signal detected"}
                              </p>
                              {whyShort ? (
                                <div className="rounded-md bg-secondary/40 px-2.5 py-2">
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Why it matters
                                  </p>
                                  <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                                    {whyShort}
                                  </p>
                                </div>
                              ) : null}
                              <p
                                className={cn(
                                  "text-xs",
                                  row.draft_body
                                    ? "font-medium text-primary"
                                    : "text-muted-foreground",
                                )}
                              >
                                {[
                                  row.draft_body
                                    ? `Draft ready · confidence ${row.confidence ?? "—"}`
                                    : "No draft yet",
                                  formatWhen(row.detected_at),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No recent signals for this company yet. Run scout again —
                      results appear here so you can pick one to draft.
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

        </div>

        <Card className="shadow-none lg:sticky lg:top-20 lg:self-start">
          <CardHeader className="gap-3">
            <div className="flex items-start gap-3">
              <Avatar
                size="lg"
                className="size-11 rounded-lg after:rounded-lg"
              >
                {logoSrc ? (
                  <AvatarImage
                    src={logoSrc}
                    alt=""
                    className="rounded-lg object-contain p-1"
                  />
                ) : null}
                <AvatarFallback className="rounded-lg text-sm font-semibold">
                  {companyInitials(
                    selected?.company || companyTitle,
                    selected?.domain || site?.host,
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {(() => {
                    const workspaceSite = companyWebsite(
                      selected?.domain || matched?.domain || query.trim(),
                    );
                    if (!workspaceSite) return <span>Draft workspace</span>;
                    return (
                      <>
                        <a
                          href={workspaceSite.href}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {workspaceSite.host}
                        </a>
                        {selected?.confidence != null ? (
                          <span className="text-muted-foreground">
                            · confidence {selected.confidence}
                          </span>
                        ) : null}
                      </>
                    );
                  })()}
                </CardDescription>
                <CardTitle className="font-heading mt-1 text-xl leading-tight md:text-2xl">
                  {selected?.company ||
                    matched?.name ||
                    companyTitle ||
                    "Waiting for a scout"}
                </CardTitle>
              </div>
            </div>
            {selected?.summary ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Why now: </span>
                {parseSignalText(selected.summary, selected.implication)
                  .trigger || selected.summary}
              </p>
            ) : null}
            {draftItems.length > 0 ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={draftItems.length < 2}
                  onClick={() => selectDraftByOffset(-1)}
                  aria-label="Previous draft"
                >
                  <ChevronLeftIcon data-icon="inline-start" />
                  Prev
                </Button>
                <p className="text-xs tabular-nums text-muted-foreground">
                  Draft {activeDraftIndex + 1} of {draftItems.length}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={draftItems.length < 2}
                  onClick={() => selectDraftByOffset(1)}
                  aria-label="Next draft"
                >
                  Next
                  <ChevronRightIcon data-icon="inline-end" />
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            {selected?.draft_body || subject || body ? (
              <Tabs
                value={workspaceTab}
                onValueChange={(value) => {
                  if (value != null) setWorkspaceTab(String(value));
                }}
              >
                <TabsList className="mb-4">
                  <TabsTrigger value="draft">Draft</TabsTrigger>
                  <TabsTrigger value="send">Send</TabsTrigger>
                </TabsList>
                <TabsContent value="draft" className="flex flex-col gap-4">
                  <div className="rounded-lg border border-border bg-secondary/20 px-3 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Why now
                    </p>
                    <p className="mt-1 text-sm leading-relaxed">
                      {parseSignalText(
                        selected?.summary,
                        selected?.implication,
                      ).trigger ||
                        selected?.summary ||
                        "Signal-backed draft from this scout"}
                    </p>
                    {(selected?.evidence_hashes?.length || 0) > 0 ? (
                      <div className="mt-3 flex flex-col gap-1.5">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Cited evidence
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(selected?.evidence_hashes || [])
                            .slice(0, 4)
                            .map((h) => (
                              <Badge
                                key={h}
                                variant="outline"
                                className="font-mono text-[10px]"
                              >
                                {h.length > 14 ? `${h.slice(0, 12)}…` : h}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    ) : null}
                    {creditsSpent != null || draftApproved ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {[
                          creditsSpent != null
                            ? `Credits this scout: ${creditsSpent}`
                            : null,
                          draftApproved ? "HITL: approved" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label
                      htmlFor="draft-subject"
                      className="text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      Subject
                    </Label>
                    <Input
                      id="draft-subject"
                      value={subject}
                      onChange={(e) => {
                        setSubject(e.target.value);
                        setDraftApproved(false);
                      }}
                      onBlur={() => {
                        if (selected?.draft_body) {
                          void recordHitl("edit", { silent: true });
                        }
                      }}
                      placeholder="Short, specific subject (no spam words)"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
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
                      onChange={(e) => {
                        setBody(e.target.value);
                        setDraftApproved(false);
                      }}
                      onBlur={() => {
                        if (selected?.draft_body) {
                          void recordHitl("edit", { silent: true });
                        }
                      }}
                      placeholder="Plaintext, one clear ask — keep it human…"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Inbox-safe: short, specific, no links/hype. Approve then
                    open Gmail/Outlook — Scout never auto-sends.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={hitlBusy || !selected?.draft_body}
                      onClick={() => {
                        void (async () => {
                          await recordHitl("approve");
                          setDraftApproved(true);
                          setWorkspaceTab("send");
                        })();
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={hitlBusy}
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          `${subject.trim()}\n\n${body}`,
                        );
                        void recordHitl("edit");
                        toast.success("Copied");
                      }}
                    >
                      Copy · log edit
                    </Button>
                    <Button
                      variant="outline"
                      disabled={hitlBusy}
                      onClick={() => {
                        void (async () => {
                          await recordHitl("reject");
                          setDraftApproved(false);
                          const rest = draftItems.filter(
                            (d) => d.draft_id !== selected?.draft_id,
                          );
                          setSelected(rest[0] || null);
                          if (!rest.length) {
                            setSubject("");
                            setBody("");
                          }
                        })();
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="send" className="flex flex-col gap-4">
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
