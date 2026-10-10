"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Activity, Layers, TriangleAlert } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  readDecisions,
  statusFromDecision,
  type RecordedDecision,
} from "@/lib/decisions";
import type { Feature } from "@/lib/types";

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function FeaturePortfolio({
  features,
  sources,
}: {
  features: Feature[];
  sources: { neatlogs: boolean; entire: boolean; cfo: boolean; mock: boolean };
}) {
  const [decisions, setDecisions] = useState<Record<string, RecordedDecision>>(
    {}
  );

  useEffect(() => {
    const sync = () => setDecisions(readDecisions());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("retrench:decisions", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("retrench:decisions", sync);
    };
  }, []);

  const rows = useMemo(
    () =>
      features.map((f) => {
        const recorded = decisions[f.id];
        if (!recorded) return f;
        return {
          ...f,
          status: statusFromDecision(recorded.choice),
          driver:
            recorded.choice === "keep"
              ? "decision: keep"
              : recorded.choice === "fix"
                ? "decision: fixing"
                : "decision: paused",
        };
      }),
    [features, decisions]
  );

  const net = rows.reduce((s, f) => s + f.netContrib7d, 0);
  const worst =
    rows.find((f) => f.status === "regress" || f.status === "fixing") ??
    rows[0];
  const regressCount = rows.filter(
    (f) => f.status === "regress" || f.status === "fixing"
  ).length;
  const decidedCount = Object.keys(decisions).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6">
      <section className="retrench-enter relative overflow-hidden rounded-2xl border bg-card p-8 shadow-sm sm:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(0.92_0.04_145_/_0.5),transparent_55%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-md font-normal">
                neatlogs
              </Badge>
              <Badge variant="outline" className="rounded-md font-normal">
                entire.io
              </Badge>
              <Badge variant="outline" className="rounded-md font-normal">
                cfo.ai
              </Badge>
              {sources.mock ? (
                <Badge className="rounded-md bg-amber-600 text-white hover:bg-amber-600">
                  demo mode
                </Badge>
              ) : (
                <Badge className="rounded-md bg-emerald-700 text-white hover:bg-emerald-700">
                  live
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Your AI features are running.
              <span className="mt-1 block text-muted-foreground">
                Here&apos;s what&apos;s making money.
              </span>
            </h1>
            <p className="text-base text-muted-foreground">
              Retrench watches unit-economics drift and tells you what to{" "}
              <span className="font-medium text-emerald-700">keep</span>,{" "}
              <span className="font-medium text-amber-700">fix</span>, or{" "}
              <span className="font-medium text-red-700">kill</span>.
            </p>
            {sources.mock ? (
              <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950/80">
                Demo mode uses the Checkout Recovery story so the full{" "}
                <span className="font-medium">
                  portfolio → investigate → decide
                </span>{" "}
                flow works without live tokens.{" "}
                <Link href="/setup" className="font-medium underline-offset-4 hover:underline">
                  Open Setup
                </Link>{" "}
                to connect neatlogs / entire / cfo.ai.
              </p>
            ) : !sources.neatlogs ? (
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Hybrid mode on — money + change chapters work; neatlogs live
                traces need{" "}
                <code className="rounded bg-background px-1 font-mono text-xs">
                  NEATLOGS_PROJECT_ID
                </code>
                .{" "}
                <Link href="/setup" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Setup checklist
                </Link>
              </p>
            ) : null}
          </div>
          {worst ? (
            <div className="flex flex-col gap-3 rounded-xl border bg-background/80 p-4 backdrop-blur sm:min-w-[260px]">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <TriangleAlert className="size-3.5 text-red-600" />
                Needs attention
              </div>
              <div className="text-lg font-semibold">{worst.name}</div>
              <p className="text-sm text-muted-foreground">{worst.driver}</p>
              <Link
                href={`/features/${worst.id}`}
                className={cn(
                  buttonVariants({ size: "default" }),
                  "inline-flex w-full justify-center gap-2"
                )}
              >
                Investigate
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <ol className="retrench-enter retrench-enter-delay-1 grid gap-3 sm:grid-cols-3">
        {[
          {
            step: "1",
            title: "Pick a feature",
            body: "Open any row in the portfolio.",
          },
          {
            step: "2",
            title: "Read three chapters",
            body: "Runtime · Change · Money.",
          },
          {
            step: "3",
            title: "Keep · Fix · Kill",
            body:
              decidedCount > 0
                ? `${decidedCount} decision${decidedCount === 1 ? "" : "s"} recorded this session.`
                : "Confirm a decision to close the loop.",
          },
        ].map((s) => (
          <li
            key={s.step}
            className="flex gap-3 rounded-xl border bg-card/80 px-4 py-3 shadow-sm"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
              {s.step}
            </span>
            <div>
              <div className="text-sm font-medium">{s.title}</div>
              <div className="text-xs text-muted-foreground">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="retrench-enter retrench-enter-delay-1 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Activity className="size-3.5" />
              Net Feature Margin (7d)
            </CardDescription>
            <CardTitle className="text-3xl tracking-tight">
              {money(net)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Deterministic rollup · cfo.ai assumptions
          </CardContent>
        </Card>
        <Card className="retrench-enter retrench-enter-delay-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Layers className="size-3.5" />
              Features tracked
            </CardDescription>
            <CardTitle className="text-3xl tracking-tight">
              {rows.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Agents instrumented via neatlogs
          </CardContent>
        </Card>
        <Card className="retrench-enter retrench-enter-delay-3 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TriangleAlert className="size-3.5" />
              Regressions
            </CardDescription>
            <CardTitle className="text-3xl tracking-tight">
              {regressCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Crossing the keep / kill cut line
          </CardContent>
        </Card>
      </section>

      <Card className="retrench-enter retrench-enter-delay-3 shadow-sm">
        <CardHeader>
          <CardTitle>Feature portfolio</CardTitle>
          <CardDescription>
            Click any row — investigate, then keep / fix / kill
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Net contrib (7d)</TableHead>
                <TableHead>Cost / success</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => (
                <TableRow key={f.id} className="group relative">
                  <TableCell>
                    <Link
                      href={`/features/${f.id}`}
                      className="absolute inset-0"
                      aria-label={`Investigate ${f.name}`}
                    />
                    <div className="font-medium">{f.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.agents.join(" → ")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={f.status} />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{money(f.netContrib7d)}</span>{" "}
                    <span
                      className={
                        f.netContribDelta < 0
                          ? "text-sm text-red-600"
                          : "text-sm text-emerald-700"
                      }
                    >
                      ({f.netContribDelta >= 0 ? "+" : ""}
                      {money(f.netContribDelta)})
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    ${f.costPerSuccess.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {f.driver}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "pointer-events-none opacity-80 transition group-hover:opacity-100"
                      )}
                    >
                      Open
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
