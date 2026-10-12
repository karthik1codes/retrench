"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { SignalItem } from "@/data/signals";
import { SEGMENT } from "@/data/signals";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

export function Watchlist({ signals }: { signals: SignalItem[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(
    signals.find((s) => s.draft)?.id ?? signals[0]?.id ?? "",
  );
  const current = signals.find((s) => s.id === active) ?? signals[0];

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".wl-row", {
        y: 14,
        opacity: 0,
        duration: 0.4,
        stagger: 0.06,
        ease: "power2.out",
      });
    },
    { scope: root, dependencies: [signals.length] },
  );

  if (!signals.length) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Watchlist</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          No live signals yet. Run a scout to populate this list.
        </p>
        <ButtonLink href="/scout" className="mt-6">
          Scout a company
        </ButtonLink>
      </div>
    );
  }

  return (
      <div ref={root} className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-8">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Weekly watchlist
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Who to reach this week
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            Segment: {SEGMENT}. Open a company, review the draft, or run a fresh
            scout.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          <ul className="min-w-0 space-y-2">
            {signals.map((s) => {
              const selected = s.id === current?.id;
              return (
                <li key={s.id} className="wl-row">
                  <button
                    type="button"
                    onClick={() => setActive(s.id)}
                    className={cn(
                      "flex w-full flex-col gap-1.5 rounded-xl border px-4 py-4 text-left transition",
                      selected
                        ? "border-primary bg-accent/25"
                        : "border-border bg-card hover:bg-secondary/50",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-heading text-lg font-semibold">
                        {s.company}
                      </span>
                      <Badge variant="secondary">{s.severity}</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {s.summary}
                    </span>
                    <span className="text-xs font-medium text-primary">
                      {s.draft
                        ? `Draft ready · confidence ${s.draft.confidence}`
                        : "Qualified — scout for a new draft"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
            {current ? (
              <Card className="h-full shadow-none">
                <CardHeader>
                  <CardDescription>{current.domain}</CardDescription>
                  <CardTitle className="font-heading text-2xl">
                    {current.company}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      Why now.{" "}
                    </span>
                    {current.why}
                  </p>
                  <Separator />
                  {current.draft ? (
                    <div className="space-y-3">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Draft · not sent
                      </p>
                      <p className="font-medium">{current.draft.subject}</p>
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
                        {current.draft.body}
                      </pre>
                      <ButtonLink
                        href={`/scout?q=${encodeURIComponent(current.domain)}`}
                        className="mt-2"
                      >
                        Continue in Scout
                      </ButtonLink>
                    </div>
                  ) : (
                    <ButtonLink
                      href={`/scout?q=${encodeURIComponent(current.domain)}`}
                    >
                      Scout this company
                    </ButtonLink>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>
      </div>
  );
}
