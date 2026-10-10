"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FeatureState = {
  featureId: string;
  featureName: string;
  decision: string;
  reason: string;
  fixBrief?: string;
  paused: boolean;
  cliff: boolean;
  liveSuccessRate?: number;
  errorTraces: number;
  okTraces: number;
  atRiskPerDay?: number;
  decidedAt: string;
  watchdog?: {
    active: boolean;
    ok?: boolean;
    detail: string;
    lastCheckAt?: string;
  };
};

type AgentState = {
  lastTickAt?: string;
  features: Record<string, FeatureState>;
  recentTicks: {
    at: string;
    featuresChecked: number;
    cliffs: number;
    summary: string;
  }[];
  briefs: { featureId: string; path: string; at: string }[];
};

export default function AgentPage() {
  const [state, setState] = useState<AgentState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/agent/state", { cache: "no-store" });
    const json = (await res.json()) as AgentState;
    setState(json);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runTick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/tick", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "tick failed");
      setState(json.state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "tick failed");
    } finally {
      setBusy(false);
    }
  }

  async function runWatchdog(featureId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/watchdog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "watchdog failed");
      setState(json.state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "watchdog failed");
    } finally {
      setBusy(false);
    }
  }

  const features = Object.values(state?.features ?? {});

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Badge className="rounded-md bg-primary text-primary-foreground hover:bg-primary">
            autonomous control agent
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">
            Retrench control agent
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Long-running loop: watch neatlogs cliffs → investigate (runtime +
            change + money) → keep / fix / kill → write fix briefs or pause →
            Watchdog verifies in neatlogs. Run locally or on the hackathon EC2.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void runTick()}
            disabled={busy}
            className="gap-1.5"
          >
            <Play className="size-3.5" />
            Run tick
          </Button>
          <Button
            variant="outline"
            onClick={() => void refresh()}
            disabled={busy}
            className="gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Last tick</CardDescription>
            <CardTitle className="text-base font-medium">
              {state?.lastTickAt
                ? new Date(state.lastTickAt).toLocaleString("en-US")
                : "Not run yet"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Features tracked</CardDescription>
            <CardTitle className="text-3xl tracking-tight">
              {features.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Open cliffs</CardDescription>
            <CardTitle className="text-3xl tracking-tight">
              {features.filter((f) => f.cliff).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="size-4" />
            Feature decisions
          </CardTitle>
          <CardDescription>
            Autonomous keep / fix / kill from the latest tick
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {features.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ticks yet. Click <strong>Run tick</strong> or start{" "}
              <code className="font-mono text-xs">
                python demo/agents/retrench_control_agent.py
              </code>{" "}
              on EC2.
            </p>
          ) : (
            features.map((f) => (
              <div
                key={f.featureId}
                className="rounded-xl border p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    <Link
                      href={`/features/${f.featureId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {f.featureName}
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {f.cliff ? (
                      <Badge className="rounded-md bg-red-600 text-white hover:bg-red-600">
                        cliff
                      </Badge>
                    ) : null}
                    {f.paused ? (
                      <Badge className="rounded-md bg-zinc-600 text-white hover:bg-zinc-600">
                        paused
                      </Badge>
                    ) : null}
                    <Badge className="rounded-md uppercase">
                      {f.decision}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-muted-foreground">{f.reason}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Live sample: {f.okTraces} OK / {f.errorTraces} ERROR
                  {f.liveSuccessRate != null
                    ? ` · ${(f.liveSuccessRate * 100).toFixed(0)}%`
                    : ""}
                  {f.atRiskPerDay
                    ? ` · ~$${f.atRiskPerDay.toLocaleString("en-US")}/day at risk`
                    : ""}
                </p>
                {f.watchdog ? (
                  <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      {f.watchdog.detail}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={busy}
                      onClick={() => void runWatchdog(f.featureId)}
                    >
                      <ShieldCheck className="size-3.5" />
                      Run Watchdog
                    </Button>
                  </div>
                ) : null}
                {f.decision === "fix" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Fix brief written under{" "}
                    <code className="font-mono">web/.retrench/briefs/</code> —
                    hand to Cursor / coding agent.
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Recent ticks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {(state?.recentTicks ?? []).slice(0, 8).map((t) => (
            <div
              key={t.at}
              className="flex flex-col gap-0.5 rounded-lg border px-3 py-2 sm:flex-row sm:justify-between"
            >
              <span>{t.summary}</span>
              <span className="shrink-0 text-xs">
                {new Date(t.at).toLocaleString("en-US")}
              </span>
            </div>
          ))}
          {(state?.recentTicks ?? []).length === 0 ? (
            <p>No history yet.</p>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        EC2: run the control agent as a systemd service (see{" "}
        <code className="font-mono">infra/AWS.md</code>). Lambda can also{" "}
        <code className="font-mono">POST /api/agent/tick</code> every 15m.
        {" · "}
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto p-0")}
        >
          Portfolio
        </Link>
      </p>
    </div>
  );
}
