"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ActivityIcon,
  ArrowRightIcon,
  Building2Icon,
  FileTextIcon,
  RadarIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";

const NAV: {
  label: string;
  icon: typeof SearchIcon;
  active?: boolean;
  count?: number;
}[] = [
  { label: "Scout", icon: SearchIcon, active: true },
  { label: "Watchlist", icon: Building2Icon },
  { label: "Drafts", icon: FileTextIcon, count: 3 },
  { label: "Signals", icon: ActivityIcon },
];

const TARGETS = [
  {
    name: "Multiply Labs",
    meta: "Robotics · series_b",
    status: "Live",
    detail: "1 draft",
  },
  {
    name: "Vitalize",
    meta: "Health · Uncategorized",
    status: "Drafting",
    detail: "1 draft",
  },
  {
    name: "Avarra",
    meta: "AI · Uncategorized",
    status: "Idle",
    detail: "1 draft",
  },
] as const;

export function LandingHero() {
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!stageRef.current) return;
      gsap.fromTo(
        stageRef.current,
        { y: 48, rotateX: 12, opacity: 0.4 },
        {
          y: 0,
          rotateX: 6,
          opacity: 1,
          duration: 1.1,
          ease: "power3.out",
        },
      );
    },
    { scope: stageRef },
  );

  return (
    <section className="relative overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-24">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.45_0.16_25_/_0.35),transparent_60%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
            <SparklesIcon className="size-3" />
            New
            <span className="text-muted-foreground">
              Weekly draft companies are live
            </span>
          </Badge>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.05]">
            Scout any company,
            <br />
            close to every trigger
          </h1>

          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Detect funding, hiring, and exec moves. Draft evidence-backed notes.
            You choose the contact and send — Scout never sends for you.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/scout" size="lg" className="px-6">
              Scout a company
              <ArrowRightIcon data-icon="inline-end" />
            </ButtonLink>
            <ButtonLink href="/login" variant="outline" size="lg" className="px-6">
              Sign in
            </ButtonLink>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Real triggers only · evidence-cited drafts · you always send
          </p>
        </div>

        <div className="perspective-[1400px] mt-14 sm:mt-20">
          <div
            ref={stageRef}
            className="origin-top transform-gpu will-change-transform"
            style={{ transform: "rotateX(6deg)" }}
          >
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-card shadow-[0_40px_120px_-40px_oklch(0.2_0.08_25_/_0.8)] ring-1 ring-white/5">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <RadarIcon className="size-3.5" />
                  </span>
                  <span className="text-sm font-medium">Signal Scout</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground">
                  <SearchIcon className="size-3.5" />
                  Search
                  <kbd className="rounded border border-white/10 px-1 font-mono text-[10px]">
                    ⌘K
                  </kbd>
                </div>
              </div>

              <div className="grid md:grid-cols-[220px_1fr]">
                <aside className="hidden border-e border-white/5 bg-black/20 p-3 md:block">
                  <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Main
                  </p>
                  <ul className="mt-2 flex flex-col gap-0.5">
                    {NAV.map((item) => (
                      <li key={item.label}>
                        <div
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                            item.active
                              ? "bg-white/8 text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          <item.icon className="size-3.5" />
                          <span className="flex-1">{item.label}</span>
                          {item.count ? (
                            <Badge variant="secondary">{item.count}</Badge>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Recent runs
                  </p>
                  <ul className="mt-2 flex flex-col gap-1 px-2 text-xs text-muted-foreground">
                    <li>Scout multiplylabs.com</li>
                    <li>Draft for Vitalize raise</li>
                    <li>Find contact at avarra.ai</li>
                  </ul>
                </aside>

                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">This week</p>
                      <h2 className="text-lg font-semibold tracking-tight">
                        Draft companies
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Live triggers, drafted for your review.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <ButtonLink href="/scout" size="sm">
                        Run scout
                      </ButtonLink>
                      <ButtonLink href="/watchlist" size="sm" variant="outline">
                        Watchlist
                      </ButtonLink>
                    </div>
                  </div>

                  <div className="mt-5 grid auto-rows-fr gap-3 sm:grid-cols-2">
                    <div className="flex h-full flex-col rounded-xl border border-white/8 bg-background/50 p-4">
                      <p className="text-xs text-muted-foreground">
                        Live metrics
                      </p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Draft confidence
                      </p>
                      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                        88
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Evidence-backed · inbox-safe
                      </p>
                    </div>
                    <div className="flex h-full flex-col rounded-xl border border-white/8 bg-background/50 p-4">
                      <p className="text-xs text-muted-foreground">Throughput</p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Signals this week
                      </p>
                      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                        33
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Across 14 industries
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Targets
                    </p>
                    {TARGETS.map((row) => (
                      <div
                        key={row.name}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-background/40 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {row.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {row.meta}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge
                            variant={
                              row.status === "Live" ? "default" : "secondary"
                            }
                          >
                            {row.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {row.detail}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
