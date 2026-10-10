import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CircleDollarSign,
  GitCommitHorizontal,
  Radar,
} from "lucide-react";
import { DecisionActions } from "@/components/decision-actions";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Feature, InvestigateBrief } from "@/lib/types";

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const decisionStyles = {
  keep: "bg-emerald-700 text-white hover:bg-emerald-700",
  fix: "bg-amber-600 text-white hover:bg-amber-600",
  kill: "bg-red-700 text-white hover:bg-red-700",
} as const;

const decisionWhy = {
  keep: "Leave it running — margin clears the cut line.",
  fix: "Ship the brief — restore success rate before more contribution bleeds.",
  kill: "Pause autonomy — stop paying OpEx on a feature that lost the keep line.",
} as const;

function neatlogsTraceUrl(traceId: string) {
  const base = (
    process.env.NEXT_PUBLIC_NEATLOGS_APP_URL || "https://app.neatlogs.com"
  ).replace(/\/$/, "");
  const project = process.env.NEXT_PUBLIC_NEATLOGS_PROJECT_ID;
  if (project) {
    return `${base}/projects/${project}/traces/${traceId}`;
  }
  return `${base}/`;
}

export function InvestigateView({
  brief,
  portfolio,
}: {
  brief: InvestigateBrief;
  portfolio: Feature[];
}) {
  const { feature, runtime, change, money: mon, decision, fixBrief } = brief;
  const idx = portfolio.findIndex((f) => f.id === feature.id);
  const next = idx >= 0 ? portfolio[idx + 1] : undefined;
  const atRisk = mon.lostContributionPerDay ?? 0;
  const live = runtime.liveTraces?.length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="retrench-enter flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-2 mb-3 gap-1.5"
            )}
          >
            <ArrowLeft className="size-3.5" />
            Portfolio
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">
            {feature.name}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Agents:{" "}
            <span className="font-mono text-sm">{feature.agents.join(" → ")}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={feature.status} />
          <Badge
            className={cn(
              "rounded-md uppercase tracking-wide",
              decisionStyles[decision]
            )}
          >
            {decision}
          </Badge>
        </div>
      </div>

      {/* Business “so what” — why the user cares */}
      <section className="retrench-enter retrench-enter-delay-1 grid gap-3 sm:grid-cols-3">
        <Card className="shadow-sm sm:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>Why this matters</CardDescription>
            <CardTitle className="text-lg leading-snug tracking-tight">
              {runtime.soWhat ??
                "Retrench joins runtime, change, and money so you decide keep / fix / kill with a dollar line — not vibes."}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {decisionWhy[decision]} Recommended action:{" "}
            <span className="font-medium uppercase text-foreground">
              {decision}
            </span>
            .
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>At risk (modeled)</CardDescription>
            <CardTitle className="text-3xl tracking-tight">
              {atRisk ? `${money(atRisk)}/day` : money(mon.netMargin)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {atRisk
              ? "Lost contribution / day if the cliff continues"
              : "Net feature margin (period)"}
          </CardContent>
        </Card>
      </section>

      <Alert className="retrench-enter retrench-enter-delay-1 border-primary/20 bg-card shadow-sm">
        <AlertTitle className="text-base">
          What to ship if you choose Fix
        </AlertTitle>
        <AlertDescription className="text-sm leading-relaxed">
          {fixBrief}
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="money" className="retrench-enter retrench-enter-delay-2 gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="money" className="gap-1.5">
            <CircleDollarSign className="size-3.5" />
            Money · impact
          </TabsTrigger>
          <TabsTrigger value="runtime" className="gap-1.5">
            <Radar className="size-3.5" />
            Runtime · proof
          </TabsTrigger>
          <TabsTrigger value="change" className="gap-1.5">
            <GitCommitHorizontal className="size-3.5" />
            Change · cause
          </TabsTrigger>
        </TabsList>

        <TabsContent value="money" className="mt-0">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>What you gain or lose</CardTitle>
              <CardDescription>
                Net margin {money(mon.netMargin)}
                {atRisk ? ` · ~${money(atRisk)}/day at risk` : ""} · formulas
                from cfo.ai assumptions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              <p className="rounded-xl border bg-muted/20 p-4 leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Your profit lever: </span>
                Fix restores recovered checkouts (contribution) and cuts failure
                tax. Kill stops agent OpEx but also stops recovery revenue. Keep
                only if live success stays above the cut line.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-muted-foreground">Contribution</div>
                  <div className="mt-1 text-xl font-semibold tracking-tight">
                    {money(mon.contribution)}
                  </div>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-muted-foreground">Agent OpEx</div>
                  <div className="mt-1 text-xl font-semibold tracking-tight">
                    {money(mon.agentOpex)}
                  </div>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-muted-foreground">Failure tax</div>
                  <div className="mt-1 text-xl font-semibold tracking-tight">
                    {money(mon.failureTax)}
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <div className="mb-2 font-medium">Scenarios — pick a $ outcome</div>
                <div className="space-y-2">
                  {mon.scenarios.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-xl border p-4"
                    >
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-muted-foreground">
                          {s.recommendation}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "shrink-0 font-semibold",
                          s.delta < 0 ? "text-red-600" : "text-emerald-700"
                        )}
                      >
                        {s.delta >= 0 ? "+" : ""}
                        {money(s.delta)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runtime" className="mt-0">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Proof from production</CardTitle>
              <CardDescription>
                Live success {(runtime.successRate * 100).toFixed(0)}% · Cost /
                success ${runtime.costPerSuccess.toFixed(2)}
                {live ? ` · ${live} neatlogs run(s)` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                neatlogs answers{" "}
                <span className="font-medium text-foreground">
                  “is the agent actually failing?”
                </span>{" "}
                — not a spreadsheet guess. Use these runs as evidence when you
                ask eng to Fix, or when you Kill to stop spend.
              </p>

              {runtime.openIncidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No failing runs in the live sample.
                </p>
              ) : (
                runtime.openIncidents.map((i) => (
                  <div
                    key={i.id}
                    className="rounded-xl border border-red-200/80 bg-red-50/50 p-4 text-sm"
                  >
                    <div className="font-medium text-red-950">{i.title}</div>
                    <div className="mt-1 text-muted-foreground">
                      {i.failingRuns} failing run{i.failingRuns === 1 ? "" : "s"}{" "}
                      — each failed recovery is lost contribution + failure tax
                    </div>
                  </div>
                ))
              )}

              {runtime.liveTraces && runtime.liveTraces.length > 0 ? (
                <div>
                  <div className="mb-2 text-sm font-medium">
                    Open the failing run (eng depth)
                  </div>
                  <ul className="space-y-2">
                    {runtime.liveTraces.map((t) => {
                      const bad = (t.status || "").toUpperCase() === "ERROR";
                      return (
                        <li key={t.id}>
                          <a
                            href={neatlogsTraceUrl(t.id)}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition hover:bg-muted/50",
                              bad && "border-red-200/80"
                            )}
                          >
                            <span>
                              <span className="font-medium">
                                {t.name ?? "trace"}
                              </span>
                              <span className="ml-2 font-mono text-xs text-muted-foreground">
                                {t.id.slice(0, 12)}…
                              </span>
                              {t.status ? (
                                <Badge
                                  className={cn(
                                    "ml-2 rounded-md capitalize",
                                    bad
                                      ? "bg-red-600 text-white hover:bg-red-600"
                                      : "bg-emerald-700 text-white hover:bg-emerald-700"
                                  )}
                                >
                                  {t.status}
                                </Badge>
                              ) : null}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              neatlogs
                              <ArrowUpRight className="size-3.5" />
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {runtime.evidenceSpans.map((s) => (
                    <li key={s} className="flex gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="change" className="mt-0">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>What caused the cliff</CardTitle>
              <CardDescription>
                {change.commit
                  ? `Commit ${change.commit}`
                  : "No commit linked yet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">
                  Why you care:{" "}
                </span>
                Entire ties the margin drop to a coding session — so Fix is a
                known rollback/patch, not a fishing expedition.
              </p>
              <p className="leading-relaxed">{change.summary}</p>
              {change.sessionId ? (
                <p>
                  Session{" "}
                  <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {change.sessionId}
                  </code>
                </p>
              ) : null}
              {change.filesTouched.length > 0 ? (
                <div>
                  <div className="mb-2 font-medium">Files to touch in the fix</div>
                  <ul className="space-y-1.5 font-mono text-xs text-muted-foreground">
                    {change.filesTouched.map((f) => (
                      <li
                        key={f}
                        className="rounded-md border bg-muted/20 px-2 py-1.5"
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DecisionActions
        featureId={feature.id}
        recommended={decision}
        nextFeatureId={next?.id}
        nextFeatureName={next?.name}
        atRiskPerDay={atRisk}
      />
    </div>
  );
}
