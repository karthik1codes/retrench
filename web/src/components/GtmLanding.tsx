"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowRightIcon,
  RadarIcon,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { DEMO_SIGNALS } from "@/data/signals";

const STEPS = [
  {
    label: "Detect signal",
    body: "Gallatin AI raised $50M Series A — fresh capital, new GTM mandate.",
    meta: "Funding · this week",
  },
  {
    label: "Qualify account",
    body: "Series A fintech SaaS, US, hiring into revenue roles.",
    meta: "Segment match",
  },
  {
    label: "Draft outreach",
    body: "Short note that cites the raise — ready for your review.",
    meta: "Evidence-backed",
  },
  {
    label: "Recommended action",
    body: "Reach Woody Glier (CEO) while the funding window is open.",
    meta: "You send",
  },
] as const;

const CAPABILITIES = [
  {
    title: "Signal detection",
    body: "Funding, hiring surges, and exec moves — only when something real happened.",
  },
  {
    title: "Account research",
    body: "Company context and trigger evidence so every draft has a reason to exist.",
  },
  {
    title: "Contact resolve",
    body: "Find decision-makers and business emails, then open your own mail client.",
  },
  {
    title: "Watchlist",
    body: "A weekly queue of companies worth a conversation — never auto-sent.",
  },
] as const;

export function GtmLanding() {
  const { data: session } = useSession();
  const featured = DEMO_SIGNALS.find((s) => s.id === "gallatin") || DEMO_SIGNALS[0];

  return (
    <div className="gtm-canvas relative min-h-[100svh] text-foreground">
      <div className="gtm-grid pointer-events-none absolute inset-0" aria-hidden />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <RadarIcon className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">
              Signal Scout
            </span>
            <span className="block text-[11px] text-muted-foreground">
              trigger-event GTM
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="/scout" className="hover:text-foreground">
            Scout
          </Link>
          <Link href="/watchlist" className="hover:text-foreground">
            Watchlist
          </Link>
          <Link href="/dashboard" className="hover:text-foreground">
            Overview
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {session?.user ? (
            <ButtonLink href="/scout" size="sm">
              Open scout
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/login" size="sm">
                Get started
              </ButtonLink>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="text-sm text-muted-foreground">
            Real-time GTM infrastructure for outbound that waits for a reason
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.05]">
            The signal graph
            <br />
            for your outreach
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Detect funding, hiring, and exec moves. Draft evidence-backed notes.
            You choose the contact and send.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/scout" size="lg" className="px-6">
              Scout a company
              <ArrowRightIcon data-icon="inline-end" />
            </ButtonLink>
            <ButtonLink href="/watchlist" variant="outline" size="lg" className="px-6">
              This week&apos;s watchlist
            </ButtonLink>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Scout execution with context
            </p>
            <p className="text-xs text-muted-foreground">
              {featured.company} · illustrative
            </p>
          </div>
          <div className="gtm-panel overflow-hidden rounded-xl">
            <div className="border-b border-border px-4 py-3 font-mono text-xs text-muted-foreground sm:px-5">
              signal scout · company scout
            </div>
            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
              <ol className="space-y-0 divide-y divide-border px-4 py-2 sm:px-5">
                {STEPS.map((step, i) => (
                  <li key={step.label} className="flex gap-3 py-4">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 font-mono text-[11px] font-medium text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{step.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {step.body}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/80">
                        {step.meta}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <aside className="border-t border-border bg-black/25 p-5 lg:border-t-0 lg:border-s">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  That changes the next move
                </p>
                <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                  Reach {featured.company} while the {featured.summary.includes("raised") ? "raise" : "trigger"} is still fresh.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {featured.why}
                </p>
                <div className="mt-6 rounded-lg border border-border bg-card/60 p-4">
                  <p className="text-xs text-muted-foreground">Proposed next step</p>
                  <p className="mt-1 text-sm font-medium">
                    Open scout for {featured.domain}, resolve a contact, send from
                    your inbox.
                  </p>
                </div>
                <ButtonLink
                  href={`/scout?q=${encodeURIComponent(featured.domain)}`}
                  className="mt-5 w-full"
                >
                  Run this scout
                </ButtonLink>
              </aside>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            What scout does
          </p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight">
            Context before you send.
          </h2>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Signal Scout gathers the evidence. You use it to decide who to reach
            and what to say.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {CAPABILITIES.map((c) => (
              <Link
                key={c.title}
                href="/scout"
                className="gtm-panel group rounded-xl p-5 transition hover:border-primary/40"
              >
                <h3 className="text-lg font-semibold tracking-tight group-hover:text-primary">
                  {c.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {c.body}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center sm:px-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Build outreach around what just happened.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in, scout a company, send from your mailbox.
              </p>
            </div>
            <ButtonLink href="/login" size="lg" className="px-6">
              Get started
              <ArrowRightIcon data-icon="inline-end" />
            </ButtonLink>
          </div>
        </section>
      </main>
    </div>
  );
}
