"use client";

import { useMemo, useState } from "react";
import { CheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const INPUTS = [
  { id: "company", label: "Company", hint: "Domain or name", tone: "weights" },
  { id: "signal", label: "Signal", hint: "Funding · hiring · exec", tone: "compute" },
  { id: "contact", label: "Contact", hint: "Business email", tone: "routing" },
  { id: "prompt", label: "Angle", hint: "Inbox-safe draft brief", tone: "prompt" },
] as const;

const OUTPUTS = [
  { id: "gmail", label: "Gmail compose", hint: "Waiting for draft" },
  { id: "outlook", label: "Outlook", hint: "Waiting for draft" },
  { id: "hitl", label: "HITL log", hint: "Approve · edit · reject" },
  { id: "watch", label: "Watchlist", hint: "Weekly refresh" },
] as const;

export function LandingWorkflow() {
  const [connected, setConnected] = useState<string[]>(["company"]);

  const done = connected.length;
  const ready = done === INPUTS.length;

  const endpointLabel = useMemo(
    () => (ready ? "draft-ready" : `awaiting · ${done}/4`),
    [done, ready],
  );

  function toggle(id: string) {
    setConnected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function connectAll() {
    setConnected(INPUTS.map((i) => i.id));
  }

  function reset() {
    setConnected(["company"]);
  }

  return (
    <section className="border-t border-white/5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">Workflow</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Wire up a scout in a minute
          </h2>
          <p className="mt-4 text-muted-foreground">
            Connect a company, signal, contact, and angle. Scout turns the graph
            into a draft you can open in mail.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={reset}>
            Reset
          </Button>
          <Button type="button" size="sm" onClick={connectAll}>
            Connect all
          </Button>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_0.9fr_1fr]">
          <div className="flex flex-col gap-2">
            {INPUTS.map((item) => {
              const on = connected.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                    on
                      ? "border-primary/50 bg-primary/10"
                      : "border-white/10 bg-card hover:bg-white/5",
                  )}
                >
                  <span>
                    <span className="block text-sm font-medium">
                      {item.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  </span>
                  <Badge variant={on ? "default" : "outline"}>
                    {on ? "Connected" : "Connect"}
                  </Badge>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-card/60 p-6 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Endpoint
            </p>
            <p className="font-mono text-lg font-semibold tracking-tight">
              {endpointLabel}
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {INPUTS.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full border",
                      connected.includes(item.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white/20",
                    )}
                  >
                    {connected.includes(item.id) ? (
                      <CheckIcon className="size-2.5" />
                    ) : null}
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Tap inputs to connect · {done} of 4
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {OUTPUTS.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-2xl border px-4 py-3 transition",
                  ready
                    ? "border-primary/40 bg-primary/10"
                    : "border-white/10 bg-card",
                )}
              >
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">
                  {ready ? "Ready" : item.hint}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
