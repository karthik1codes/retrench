"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { OutreachPermissionDialog } from "@/components/OutreachPermissionDialog";
import { ScoutFlowStepper } from "@/components/ScoutFlowStepper";
import { useSentDrafts } from "@/hooks/use-sent-drafts";
import type {
  ContactRow,
  DraftRow,
  MatchedCompany,
  ScoutContext,
} from "@/lib/scout-agent";
import type { TargetCategory, TargetCompany } from "@/lib/targets";
import type { SentChannel } from "@/lib/sent-drafts";
import {
  rememberApproval,
  rememberEdit,
  rememberSpamReject,
  styleNotesForPrompt,
} from "@/lib/draft-memory";
import {
  loadOutreachPrefs,
  saveOutreachPrefs,
  type OutreachPrefs,
  type SendMode,
} from "@/lib/outreach-prefs";
import { Skeleton } from "@/components/ui/skeleton";
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

function normalizeIndustry(value?: string | null) {
  const trimmed = (value || "").trim();
  return trimmed || "Uncategorized";
}

function companyDedupeKey(company: TargetCompany) {
  const domain = (company.domain || "").trim().toLowerCase();
  const name = (company.name || "").trim().toLowerCase();
  return domain || name || JSON.stringify(company);
}

/** Prefer the row with the newest draft when the API returns duplicates. */
function dedupeTargetCompanies(companies: TargetCompany[]): TargetCompany[] {
  const byKey = new Map<string, TargetCompany>();
  for (const company of companies) {
    const key = companyDedupeKey(company);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, company);
      continue;
    }
    const prevAt = prev.last_draft_at || "";
    const nextAt = company.last_draft_at || "";
    if (nextAt > prevAt) byKey.set(key, company);
  }
  return [...byKey.values()];
}

function groupTargetsByIndustry(companies: TargetCompany[]): TargetCategory[] {
  const byIndustry = new Map<string, TargetCompany[]>();
  for (const company of companies) {
    const industry = normalizeIndustry(company.industry);
    const row = { ...company, industry };
    const bucket = byIndustry.get(industry);
    if (bucket) bucket.push(row);
    else byIndustry.set(industry, [row]);
  }
  return [...byIndustry.entries()]
    .map(([industry, rows]) => ({
      industry,
      count: rows.length,
      companies: rows,
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.industry.localeCompare(b.industry, undefined, {
          sensitivity: "base",
        }),
    );
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
  const [targetCompanies, setTargetCompanies] = useState<TargetCompany[]>([]);
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
  const [prefs, setPrefs] = useState<OutreachPrefs>(() => loadOutreachPrefs());
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const baselineRef = useRef<{ subject: string; body: string }>({
    subject: "",
    body: "",
  });
  const { markSent, setGmailVerified } = useSentDrafts();

  useEffect(() => {
    const sync = () => setPrefs(loadOutreachPrefs());
    sync();
    window.addEventListener("signal-scout:outreach-prefs", sync);
    return () =>
      window.removeEventListener("signal-scout:outreach-prefs", sync);
  }, []);

  async function recordHitl(
    action: "approve" | "edit" | "reject",
    opts?: { silent?: boolean },
  ) {
    setHitlBusy(true);
    const companyName =
      selected?.company || matched?.name || query.trim() || undefined;
    try {
      if (action === "approve") {
        rememberApproval({ company: companyName, subject, body });
      } else if (action === "edit") {
        const before = baselineRef.current;
        if (
          before.subject !== subject ||
          before.body !== body
        ) {
          rememberEdit({
            company: companyName,
            beforeSubject: before.subject,
            beforeBody: before.body,
            afterSubject: subject,
            afterBody: body,
          });
          baselineRef.current = { subject, body };
        }
      }

      const res = await fetch("/api/draft-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          draft_id: selected?.draft_id,
          signal_id: selected?.signal_id,
          company: companyName,
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
              ? "Approved — style learned · logged"
              : action === "reject"
                ? "Rejected — logged"
                : "Edit logged · style learned",
          );
        } else if (action === "approve") {
          toast.success("Approved — style learned");
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

  async function pollGmailSent(sentId: string, afterUnix: number) {
    if (!prefs.verifySent) return;
    setVerifying(true);
    const deadline = Date.now() + 90_000;
    try {
      while (Date.now() < deadline) {
        const res = await fetch("/api/gmail/verify-sent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: to.trim(),
            subject: subject.trim() || "Quick note",
            afterUnixSeconds: afterUnix,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          toast.message(
            "Reconnect Google to verify Sent (gmail.readonly).",
          );
          return;
        }
        if (data.verified && data.match?.id) {
          setGmailVerified(sentId, data.match);
          toast.success("Verified in Gmail Sent");
          return;
        }
        await new Promise((r) => setTimeout(r, 4_000));
      }
      toast.message("Not in Sent yet — check back after you hit Send in Gmail");
    } catch {
      toast.error("Could not poll Gmail Sent");
    } finally {
      setVerifying(false);
    }
  }

  async function rewriteAsInboxSafe() {
    if (!subject.trim() && !body.trim()) {
      toast.error("Nothing to rewrite");
      return;
    }
    setRewriting(true);
    const companyName =
      selected?.company || matched?.name || query.trim() || undefined;
    rememberSpamReject({ company: companyName, subject, body });
    try {
      await recordHitl("reject", { silent: true });
      const res = await fetch("/api/drafts/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: companyName,
          domain: selected?.domain || matched?.domain,
          subject,
          body,
          signal_summary:
            parseSignalText(selected?.summary, selected?.implication).trigger ||
            selected?.summary,
          reason: "spam",
          style_notes: styleNotesForPrompt(),
        }),
      });
      const data = await res.json();
      if (!data.body) throw new Error(data.error || "Rewrite failed");
      setSubject(String(data.subject || subject));
      setBody(String(data.body));
      baselineRef.current = {
        subject: String(data.subject || subject),
        body: String(data.body),
      };
      setDraftApproved(false);
      toast.success(
        data.demo
          ? "Inbox-safe rewrite ready (local fallback)"
          : "Fresh inbox-safe draft for this signal",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rewrite failed");
    } finally {
      setRewriting(false);
    }
  }

  function setSendMode(mode: SendMode) {
    const next = { ...prefs, sendMode: mode, askedAt: prefs.askedAt || new Date().toISOString() };
    saveOutreachPrefs(next);
    setPrefs(next);
    toast.message(
      mode === "agent"
        ? "Agent may send after Approve"
        : "Human-in-the-loop — you send from Gmail",
    );
  }

  const loadTargets = useCallback(async () => {
    setTargetsLoading(true);
    try {
      const res = await fetch("/api/targets", { cache: "no-store" });
      const data = await res.json();
      const unavailable =
        !res.ok ||
        data.status === "failed" ||
        data.status === "unavailable";
      if (unavailable && !data.companies?.length && !data.categories?.length) {
        setTargetsMeta({
          total: 0,
          error: data.error || "Targets unavailable",
          windowDays: data.window_days || 7,
        });
        setCategories([]);
        setTargetCompanies([]);
        return;
      }
      const flatRaw: TargetCompany[] = Array.isArray(data.companies)
        ? data.companies
        : Array.isArray(data.categories)
          ? data.categories.flatMap(
              (c: TargetCategory) => c.companies || [],
            )
          : [];
      const flat = dedupeTargetCompanies(
        flatRaw.map((c) => ({
          ...c,
          industry: normalizeIndustry(c.industry),
        })),
      );
      const cats = groupTargetsByIndustry(flat);
      setCategories(cats);
      setTargetCompanies(flat);
      setTargetsMeta({
        total: flat.length,
        windowDays: data.window_days || 7,
        lastRunAt: data.last_run_at,
        generatedAt: data.generated_at,
        error: flat.length === 0 ? data.error : undefined,
      });
      setActiveIndustry((prev) => {
        if (prev === "all") return prev;
        const industries = new Set(
          cats.map((c) => normalizeIndustry(c.industry)),
        );
        return industries.has(normalizeIndustry(prev)) ? prev : "all";
      });
    } catch {
      setTargetsMeta({ total: 0, error: "Targets unavailable" });
      setCategories([]);
      setTargetCompanies([]);
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
    baselineRef.current = { subject: parsed.subject, body: parsed.text };
    setDraftApproved(false);
  }, [selected?.signal_id, selected?.draft_id, selected?.draft_body]);

  const visibleCompanies: TargetCompany[] = useMemo(() => {
    const pool =
      targetCompanies.length > 0
        ? targetCompanies
        : categories.flatMap((c) => c.companies);
    if (activeIndustry === "all") {
      return [...pool].sort((a, b) => {
        const ta = a.last_draft_at || "";
        const tb = b.last_draft_at || "";
        if (ta !== tb) return tb.localeCompare(ta);
        return (a.name || "").localeCompare(b.name || "");
      });
    }
    const want = normalizeIndustry(activeIndustry);
    return pool.filter(
      (c) => normalizeIndustry(c.industry) === want,
    );
  }, [targetCompanies, categories, activeIndustry]);

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
                  "Signal Scout",
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

  function storeSent(
    channel: SentChannel,
    extra?: {
      gmailVerified?: boolean;
      gmailMessageId?: string | null;
      gmailThreadId?: string | null;
    },
  ) {
    const companyName =
      selected?.company || matched?.name || companyTitle || query.trim();
    const domain =
      selected?.domain || matched?.domain || company?.domain || query.trim();
    const row = markSent({
      company: companyName,
      domain,
      to: to.trim(),
      subject: subject.trim() || "Quick note",
      body,
      signalSummary:
        parseSignalText(selected?.summary, selected?.implication).trigger ||
        selected?.summary ||
        undefined,
      draftId: selected?.draft_id,
      signalId: selected?.signal_id,
      channel,
      ...extra,
    });
    return row;
  }

  function openInGmail() {
    if (!requireDraftReady()) return;
    const afterUnix = Math.floor(Date.now() / 1000) - 30;
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
    const row = storeSent("gmail");
    toast.success("Gmail opened · polling Sent to verify");
    void pollGmailSent(row.id, afterUnix);
  }

  async function agentSend() {
    if (!requireDraftReady()) return;
    if (prefs.sendMode !== "agent") {
      toast.message("Switch to Agent may send, or use Open in Gmail");
      return;
    }
    if (!draftApproved) {
      toast.message("Approve the draft first");
      setWorkspaceTab("draft");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim() || "Quick note",
          body,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        throw new Error(data.error || "Send failed");
      }
      setComposeOpened(true);
      storeSent("gmail_api", {
        gmailVerified: true,
        gmailMessageId: data.id,
        gmailThreadId: data.threadId,
      });
      toast.success("Sent via Gmail · follow-ups queued (+3d / +7d)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
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
    storeSent("outlook");
    toast.success("Outlook opened · saved to Sent with follow-ups");
  }

  function openMailApp() {
    if (!requireDraftReady()) return;
    storeSent("mailto");
    setComposeOpened(true);
    toast.success("Mail app · saved to Sent with follow-ups");
    window.location.href = mailtoUrl({
      to: to.trim(),
      subject: subject.trim() || "Quick note",
      body: body,
    });
  }

  function saveAsSentOnly() {
    if (!requireDraftReady()) return;
    storeSent("manual");
    setComposeOpened(true);
    toast.success("Stored in Sent · +3d / +7d follow-ups queued");
  }

  const company = matched || context?.company || null;
  const facts = companyFacts(company);
  const rows = overviewRows(company);
  const site = companyWebsite(company?.domain || query.trim());
  const thisMonth = monthLabel(context?.month);
  const companyTitle = (() => {
    const n = company?.name || query.trim();
    return n && String(n).toLowerCase() !== "none"
      ? n
      : site?.host || "Signal Scout";
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

  const hasCompanyPanel = Boolean(matched || context);

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4 sm:py-3">
      <OutreachPermissionDialog gmailConnected={session?.gmailConnected} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">
              Company scout
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Domain in → draft out
              {session?.user?.email ? ` · ${session.user.email}` : ""}
              {prefs.sendMode === "agent" ? " · agent send on" : " · HITL send"}
            </p>
          </div>
          <ScoutFlowStepper
            current={flowStep}
            searching={loading}
            onStepChange={handleFlowStep}
            className="max-w-sm shrink-0"
          />
        </div>

        <div className="grid items-start gap-3 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Card size="sm" className="shadow-none">
              <CardContent className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ramp.com"
                    className="min-w-0 flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void runScout();
                    }}
                  />
                  <Button
                    disabled={loading}
                    onClick={() => void runScout()}
                    className="shrink-0"
                  >
                    {loading ? "Scouting…" : "Run scout"}
                  </Button>
                </div>
                {status ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {status}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {hasCompanyPanel && (
              <Card
                size="sm"
                className="flex max-h-[min(40vh,26rem)] flex-col gap-0 overflow-hidden shadow-none"
              >
                <CardHeader className="shrink-0 border-b py-2.5">
                  <div className="flex items-center gap-2.5">
                    <CompanyAvatar
                      key={`${company?.domain || site?.host || companyTitle}-left`}
                      name={companyTitle}
                      domain={company?.domain || site?.host}
                      logoUrl={company?.logo_url}
                      size="default"
                    />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate leading-tight">
                        {companyTitle}
                      </CardTitle>
                      <CardDescription className="truncate">
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
                <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-(--card-spacing) py-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <Label className="text-muted-foreground">
                        Company info
                      </Label>
                      {rows.length > 0 ? (
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                          {rows.map((row) => (
                            <div key={row.label} className="min-w-0">
                              <dt className="text-xs text-muted-foreground">
                                {row.label}
                              </dt>
                              <dd className="truncate font-medium">
                                {row.value}
                              </dd>
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
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Profile saved. Details appear when the source returns
                          them.
                        </p>
                      )}
                      {company?.description ? (
                        <p className="line-clamp-3 text-sm text-muted-foreground">
                          {company.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg border border-border px-2 py-2">
                        <p className="text-base font-semibold tabular-nums">
                          {context?.signals_this_month ??
                            context?.signals_in_graph ??
                            items.length}
                        </p>
                        <p className="text-muted-foreground">Recent</p>
                      </div>
                      <div className="rounded-lg border border-border px-2 py-2">
                        <p className="text-base font-semibold tabular-nums">
                          {context?.signals_created ?? 0}
                        </p>
                        <p className="text-muted-foreground">New</p>
                      </div>
                      <div className="rounded-lg border border-border px-2 py-2">
                        <p className="text-base font-semibold tabular-nums">
                          {context?.drafts_created ?? draftItems.length}
                        </p>
                        <p className="text-muted-foreground">Drafts</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label className="text-muted-foreground">
                        Signals · {thisMonth}
                        {(context?.suppressed_count ?? 0) > 0
                          ? ` · ${context?.suppressed_count} skipped`
                          : ""}
                      </Label>
                      {items.length > 0 ? (
                        <ul className="flex flex-col gap-2">
                          {items.map((row, idx) => {
                            const parsed = parseSignalText(
                              row.summary,
                              row.implication,
                            );
                            const whyShort =
                              parsed.why && parsed.why.length > 120
                                ? `${parsed.why.slice(0, 117).trim()}…`
                                : parsed.why;
                            const active =
                              selected?.signal_id === row.signal_id;
                            return (
                              <li
                                key={`${row.signal_id}-${row.draft_id ?? idx}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelected(row);
                                    if (row.draft_body)
                                      setWorkspaceTab("draft");
                                  }}
                                  className={cn(
                                    "flex w-full flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-left transition",
                                    active
                                      ? "border-primary bg-accent/25"
                                      : "border-border hover:bg-secondary/40",
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <Badge variant="secondary">
                                      {(row.type === "profile"
                                        ? "snapshot"
                                        : row.type || "signal"
                                      ).replace(/_/g, " ")}
                                    </Badge>
                                    <Badge variant="outline">
                                      {row.severity}
                                    </Badge>
                                  </div>
                                  <p className="text-sm font-medium leading-snug">
                                    {parsed.trigger || "Signal detected"}
                                  </p>
                                  {whyShort ? (
                                    <p className="line-clamp-2 text-xs text-muted-foreground">
                                      {whyShort}
                                    </p>
                                  ) : null}
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {row.draft_body ? (
                                      <Badge>
                                        Draft · {row.confidence ?? "—"}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline">
                                        No draft
                                      </Badge>
                                    )}
                                    {formatWhen(row.detected_at) ? (
                                      <span className="text-xs text-muted-foreground">
                                        {formatWhen(row.detected_at)}
                                      </span>
                                    ) : null}
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No signals yet — run scout again.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card
              size="sm"
              className="flex max-h-[min(46vh,30rem)] min-h-48 flex-col gap-0 overflow-hidden shadow-none"
            >
              <CardHeader className="shrink-0 border-b py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle>This week</CardTitle>
                    <CardDescription className="truncate">
                      {targetsLoading
                        ? "Loading fetched companies…"
                        : targetsMeta.error && targetsMeta.total === 0
                          ? targetsMeta.error
                          : targetsMeta.total > 0
                            ? `${targetsMeta.total} with drafts · last ${targetsMeta.windowDays || 7}d`
                            : "No draft companies this week yet"}
                    </CardDescription>
                  </div>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={targetsLoading}
                    onClick={() => void loadTargets()}
                  >
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-0 pt-0">
                {targetsLoading ? (
                  <div className="flex flex-col gap-2 overflow-y-auto px-(--card-spacing) py-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2"
                      >
                        <Skeleton className="size-8 rounded-lg" />
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <Skeleton className="h-3.5 w-1/2" />
                          <Skeleton className="h-3 w-3/4" />
                        </div>
                        <Skeleton className="h-5 w-8 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : targetCompanies.length > 0 ? (
                  <>
                    <div className="shrink-0 px-(--card-spacing) pt-2">
                      <ScrollArea className="w-full whitespace-nowrap">
                        <div className="flex w-max gap-1.5 pb-2">
                          <Button
                            type="button"
                            size="xs"
                            variant={
                              activeIndustry === "all" ? "default" : "outline"
                            }
                            aria-pressed={activeIndustry === "all"}
                            onClick={() => setActiveIndustry("all")}
                          >
                            All ({targetsMeta.total})
                          </Button>
                          {categories.map((cat) => {
                            const industry = normalizeIndustry(cat.industry);
                            const selected =
                              normalizeIndustry(activeIndustry) === industry;
                            return (
                              <Button
                                key={industry}
                                type="button"
                                size="xs"
                                variant={selected ? "default" : "outline"}
                                aria-pressed={selected}
                                onClick={() => setActiveIndustry(industry)}
                              >
                                {industry} ({cat.count})
                              </Button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-(--card-spacing) pb-(--card-spacing)">
                      {visibleCompanies.length > 0 ? (
                        <ul className="flex flex-col gap-1.5 pe-1">
                          {visibleCompanies.map((c, idx) => (
                            <li key={`${companyDedupeKey(c)}-${idx}`}>
                              <button
                                type="button"
                                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2 text-left transition hover:bg-secondary/50"
                                onClick={() => {
                                  const next = c.domain || c.name;
                                  setQuery(next);
                                  void runScout(next);
                                }}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <CompanyAvatar
                                    name={c.name}
                                    domain={c.domain}
                                    size="sm"
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium">
                                      {c.name}
                                    </span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                      {[
                                        c.domain,
                                        normalizeIndustry(c.industry),
                                        formatWhen(c.last_draft_at),
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </span>
                                  </span>
                                </span>
                                <Badge variant="secondary">
                                  {c.draft_count ?? 0}
                                </Badge>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No companies in {normalizeIndustry(activeIndustry)}.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 px-(--card-spacing) py-4">
                    <p className="text-sm text-muted-foreground">
                      {targetsMeta.error ||
                        "No companies with drafts in the last 7 days yet."}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-fit"
                      onClick={() => void loadTargets()}
                    >
                      Retry fetch
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card
            size="sm"
            className={cn(
              "flex flex-col gap-0 overflow-hidden shadow-none lg:sticky lg:top-2",
              selected?.draft_body || subject || body
                ? "max-h-[min(82vh,48rem)] min-h-[28rem]"
                : "min-h-48",
            )}
          >
            <CardHeader className="shrink-0 gap-2 border-b py-2.5">
              <div className="flex items-center gap-2.5">
                <CompanyAvatar
                  key={`${selected?.domain || matched?.domain || site?.host || "ws"}-right`}
                  name={selected?.company || companyTitle}
                  domain={selected?.domain || matched?.domain || site?.host}
                  logoUrl={company?.logo_url}
                  size="default"
                />
                <div className="min-w-0 flex-1">
                  <CardDescription className="truncate">
                    {(() => {
                      const workspaceSite = companyWebsite(
                        selected?.domain || matched?.domain || query.trim(),
                      );
                      if (!workspaceSite) return "Draft workspace";
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
                          {selected?.confidence != null
                            ? ` · ${selected.confidence}`
                            : ""}
                        </>
                      );
                    })()}
                  </CardDescription>
                  <CardTitle className="truncate">
                    {selected?.company ||
                      matched?.name ||
                      companyTitle ||
                      "Waiting for a scout"}
                  </CardTitle>
                </div>
              </div>
              {draftItems.length > 0 ? (
                <div className="flex items-center justify-between gap-1 rounded-lg border border-border px-1">
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
                    {activeDraftIndex + 1} / {draftItems.length}
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
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-0">
              {selected?.draft_body || subject || body ? (
                <Tabs
                  value={workspaceTab}
                  onValueChange={(value) => {
                    if (value != null) setWorkspaceTab(String(value));
                  }}
                  className="flex h-full min-h-0 flex-col gap-2"
                >
                  <div className="shrink-0 px-(--card-spacing) pt-2">
                    <TabsList className="w-full">
                      <TabsTrigger value="draft" className="flex-1">
                        Draft
                      </TabsTrigger>
                      <TabsTrigger value="send" className="flex-1">
                        Send
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent
                    value="draft"
                    className="mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain data-hidden:hidden"
                  >
                    <div className="flex flex-col gap-3 px-(--card-spacing) pb-(--card-spacing)">
                      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
                        <Label className="text-muted-foreground">Why now</Label>
                        <p className="text-sm">
                          {parseSignalText(
                            selected?.summary,
                            selected?.implication,
                          ).trigger ||
                            selected?.summary ||
                            "Signal-backed draft from this scout"}
                        </p>
                        {(selected?.evidence_hashes?.length || 0) > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(selected?.evidence_hashes || [])
                              .slice(0, 4)
                              .map((h) => (
                                <Badge key={h} variant="outline">
                                  {h.length > 14 ? `${h.slice(0, 12)}…` : h}
                                </Badge>
                              ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="draft-subject">Subject</Label>
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
                          placeholder="Short, specific subject"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="draft-body">Body</Label>
                        <Textarea
                          id="draft-body"
                          className="min-h-48 resize-y"
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
                          placeholder="Plaintext, one clear ask…"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={hitlBusy || !selected?.draft_body}
                          onClick={() => {
                            void (async () => {
                              await recordHitl("approve");
                              setDraftApproved(true);
                              setWorkspaceTab("send");
                              if (prefs.sendMode === "agent" && to.trim()) {
                                toast.message(
                                  "Approved — ready for Agent send",
                                );
                              }
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
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          disabled={hitlBusy || rewriting}
                          onClick={() => void rewriteAsInboxSafe()}
                        >
                          {rewriting ? "Rewriting…" : "Spammy · rewrite"}
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
                      <p className="text-xs text-muted-foreground">
                        Approvals and edits train style memory. Flag spammy to
                        get a different inbox-safe draft for the same signal.
                      </p>
                    </div>
                  </TabsContent>
                  <TabsContent
                    value="send"
                    className="mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain data-hidden:hidden"
                  >
                    <div className="flex flex-col gap-3 px-(--card-spacing) pb-(--card-spacing)">
                      <div className="flex flex-col gap-2">
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
                        <div className="rounded-lg border border-border p-3">
                          <ul className="flex flex-col gap-2">
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
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <Separator />

                      <div className="flex flex-col gap-2">
                        <Label className="text-muted-foreground">
                          Send permission
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={
                              prefs.sendMode === "hitl" ? "default" : "outline"
                            }
                            onClick={() => setSendMode("hitl")}
                          >
                            Human in loop
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              prefs.sendMode === "agent" ? "default" : "outline"
                            }
                            onClick={() => setSendMode("agent")}
                          >
                            Agent may send
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {prefs.sendMode === "agent" ? (
                          <Button
                            disabled={sending || !draftApproved}
                            onClick={() => void agentSend()}
                          >
                            {sending
                              ? "Sending…"
                              : draftApproved
                                ? "Send via Gmail"
                                : "Approve draft first"}
                          </Button>
                        ) : null}
                        <Button
                          variant={
                            prefs.sendMode === "agent" ? "secondary" : "default"
                          }
                          disabled={verifying}
                          onClick={openInGmail}
                        >
                          {verifying ? "Verifying Sent…" : "Open in Gmail"}
                        </Button>
                        <Button variant="secondary" onClick={openInOutlook}>
                          Outlook
                        </Button>
                        <Button variant="outline" onClick={openMailApp}>
                          Mail app
                        </Button>
                        <Button variant="outline" onClick={saveAsSentOnly}>
                          Save as sent
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Signed in as {session?.user?.email || "…"}.
                        {prefs.sendMode === "agent"
                          ? " Agent send uses Gmail API after Approve, then queues +3d / +7d follow-ups."
                          : " Open in Gmail stores under Sent, polls Gmail Sent to confirm, and queues follow-ups for you."}
                        {!session?.gmailConnected
                          ? " Reconnect Google if verify/send fails."
                          : ""}
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex h-full items-center justify-center px-(--card-spacing)">
                  <p className="max-w-xs text-center text-sm text-muted-foreground">
                    Run a scout to load a draft. Company profile stays on the
                    left.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
