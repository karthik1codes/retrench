"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
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
import type { SignalItem } from "@/data/signals";
import { SEGMENT } from "@/data/signals";

gsap.registerPlugin(useGSAP);

export function Watchlist({ signals }: { signals: SignalItem[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(
    signals.find((s) => s.draft)?.id ?? signals[0]?.id ?? "",
  );
  const current = signals.find((s) => s.id === active) ?? signals[0];

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduce) return;
      gsap.from(".wl-row", {
        y: 18,
        opacity: 0,
        duration: 0.45,
        stagger: 0.07,
        ease: "power2.out",
      });
    },
    { scope: root, dependencies: [signals.length] },
  );

  return (
    <div ref={root} className="min-h-[100svh] bg-[var(--canvas)]">
      <header className="border-b border-[var(--line)] bg-[rgba(230,239,228,0.92)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 md:px-10">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-sm font-bold tracking-[0.18em] text-[var(--deep)]"
          >
            SIGNAL SCOUT
          </Link>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              render={<Link href="/scout" />}
            >
              Scout a company
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-10 md:grid-cols-[1.05fr_0.95fr] md:px-10 md:py-14">
        <section>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Who to reach this week
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Segment: {SEGMENT}. Open a company, review the draft, or scout a new
            one on EC2.
          </p>

          <ul className="mt-8 space-y-2">
            {signals.map((s) => {
              const selected = s.id === current?.id;
              return (
                <li key={s.id} className="wl-row">
                  <button
                    type="button"
                    onClick={() => setActive(s.id)}
                    className={`flex w-full flex-col gap-1 rounded-xl border px-4 py-4 text-left transition ${
                      selected
                        ? "border-primary bg-accent/30"
                        : "border-border bg-card hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-[family-name:var(--font-display)] text-lg font-semibold">
                        {s.company}
                      </span>
                      <Badge variant="secondary">{s.severity}</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {s.summary}
                    </span>
                    <span className="mt-1 text-xs font-medium text-primary">
                      {s.draft
                        ? `Draft ready · ${s.draft.confidence}`
                        : "Qualified — scout again for draft"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="md:sticky md:top-8 md:self-start">
          {current ? (
            <Card>
              <CardHeader>
                <CardDescription>{current.domain}</CardDescription>
                <CardTitle>{current.company}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Why now. </span>
                  {current.why}
                </p>
                <Separator />
                {current.draft ? (
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Draft · not sent
                    </p>
                    <p className="font-medium">{current.draft.subject}</p>
                    <pre className="whitespace-pre-wrap font-[family-name:var(--font-body)] text-sm leading-relaxed text-muted-foreground">
                      {current.draft.body}
                    </pre>
                    <Button
                      render={
                        <Link
                          href={`/scout?q=${encodeURIComponent(current.domain)}`}
                        />
                      }
                    >
                      Scout again on EC2
                    </Button>
                  </div>
                ) : (
                  <Button
                    render={
                      <Link
                        href={`/scout?q=${encodeURIComponent(current.domain)}`}
                      />
                    }
                  >
                    Trigger EC2 for this company
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
