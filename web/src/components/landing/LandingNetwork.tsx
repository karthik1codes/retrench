"use client";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";

const NODES = [
  { name: "Funding", x: "18%", y: "32%", ms: "38" },
  { name: "Hiring", x: "42%", y: "22%", ms: "41" },
  { name: "Exec move", x: "68%", y: "28%", ms: "46" },
  { name: "Product", x: "78%", y: "58%", ms: "52" },
  { name: "Geo expand", x: "32%", y: "62%", ms: "44" },
  { name: "Partnership", x: "55%", y: "70%", ms: "49" },
] as const;

const POINTS = [
  {
    title: "One scout, many industries",
    body: "Deploy once. Scout serves drafts from every industry bucket on your weekly list.",
  },
  {
    title: "Nearest-trigger routing",
    body: "Each draft cites the freshest signal for that company — you change no templates.",
  },
  {
    title: "Automatic suppress",
    body: "If an account was contacted recently, traffic moves to the next healthy target.",
  },
  {
    title: "Health every cycle",
    body: "We refresh drafts on a timer and drain stale signals before they reach your inbox.",
  },
] as const;

export function LandingNetwork() {
  return (
    <section id="network" className="border-t border-white/5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-sm text-muted-foreground">Signal network</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              Every request lands close to a real trigger
            </h2>
          </div>
          <ButtonLink href="/watchlist" variant="outline">
            See all industries
          </ButtonLink>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="relative min-h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_30%_20%,oklch(0.35_0.1_25_/_0.25),transparent_45%),oklch(0.12_0.005_260)] p-4 sm:min-h-[420px]">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(circle, oklch(1 0 0 / 0.15) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
              aria-hidden
            />
            {NODES.map((node) => (
              <div
                key={node.name}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: node.x, top: node.y }}
              >
                <div className="relative">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
                  <div className="relative rounded-full border border-primary/40 bg-background/90 px-3 py-1.5 text-xs shadow-lg">
                    <span className="font-medium">{node.name}</span>
                    <span className="ms-2 text-muted-foreground">
                      {node.ms} ms
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-3 rounded-xl border border-white/10 bg-background/80 p-3 backdrop-blur">
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Drafts / week
                </p>
                <p className="text-lg font-semibold tabular-nums">33</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Industries live
                </p>
                <p className="text-lg font-semibold tabular-nums">14</p>
              </div>
              <Badge className="ms-auto self-center">Funding · 38 ms</Badge>
            </div>
          </div>

          <ul className="flex flex-col gap-3">
            {POINTS.map((point) => (
              <li
                key={point.title}
                className="rounded-2xl border border-white/10 bg-card p-5"
              >
                <h3 className="font-semibold tracking-tight">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {point.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
