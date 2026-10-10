"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Wrench, Ban } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  readDecisions,
  writeDecision,
  type DecisionChoice,
} from "@/lib/decisions";

function money(n: number) {
  return `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const actions: {
  choice: DecisionChoice;
  label: string;
  hint: (atRisk: number) => string;
  icon: typeof Check;
  className: string;
}[] = [
  {
    choice: "keep",
    label: "Keep",
    hint: () => "Accept current economics — leave autonomy on",
    icon: Check,
    className: "bg-emerald-700 text-white hover:bg-emerald-700/90",
  },
  {
    choice: "fix",
    label: "Fix",
    hint: (atRisk) =>
      atRisk
        ? `Restore retries — claw back ~${money(atRisk)}/day`
        : "Ship the brief — restore margin",
    icon: Wrench,
    className: "bg-amber-600 text-white hover:bg-amber-600/90",
  },
  {
    choice: "kill",
    label: "Kill",
    hint: () => "Pause the agent — stop OpEx on a losing feature",
    icon: Ban,
    className: "bg-red-700 text-white hover:bg-red-700/90",
  },
];

export function DecisionActions({
  featureId,
  recommended,
  nextFeatureId,
  nextFeatureName,
  atRiskPerDay = 0,
}: {
  featureId: string;
  recommended: DecisionChoice;
  nextFeatureId?: string;
  nextFeatureName?: string;
  atRiskPerDay?: number;
}) {
  const [recorded, setRecorded] = useState<DecisionChoice | null>(null);

  useEffect(() => {
    setRecorded(readDecisions()[featureId]?.choice ?? null);
  }, [featureId]);

  function choose(choice: DecisionChoice) {
    writeDecision(featureId, choice);
    setRecorded(choice);
  }

  return (
    <section className="retrench-enter retrench-enter-delay-3 space-y-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Your call</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Retrench recommends{" "}
          <span className="font-medium text-foreground uppercase">
            {recommended}
          </span>
          {atRiskPerDay ? (
            <>
              {" "}
              because ~{money(atRiskPerDay)}/day of contribution is on the line.
            </>
          ) : (
            <> — confirm to record the portfolio decision.</>
          )}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {actions.map(({ choice, label, hint, icon: Icon, className }) => {
          const active = recorded === choice;
          return (
            <button
              key={choice}
              type="button"
              onClick={() => choose(choice)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition",
                active ? className : "bg-background hover:bg-muted/60",
                !active && choice === recommended && "ring-2 ring-ring/40"
              )}
            >
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                <Icon className="size-3.5" />
                {label}
                {active ? " · recorded" : null}
              </span>
              <span
                className={cn(
                  "text-xs",
                  active ? "text-white/85" : "text-muted-foreground"
                )}
              >
                {hint(atRiskPerDay)}
              </span>
            </button>
          );
        })}
      </div>

      {recorded ? (
        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Decision{" "}
            <span className="font-medium uppercase text-foreground">
              {recorded}
            </span>{" "}
            saved
            {recorded === "fix"
              ? " — hand the brief to eng / coding agent next."
              : recorded === "kill"
                ? " — pause checkout_agent autonomy in prod."
                : " — no change to prod."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Back to portfolio
            </Link>
            {nextFeatureId ? (
              <Link
                href={`/features/${nextFeatureId}`}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "inline-flex gap-1.5"
                )}
              >
                Next: {nextFeatureName ?? nextFeatureId}
                <ArrowRight className="size-3.5" />
              </Link>
            ) : (
              <Button size="sm" disabled>
                Walkthrough complete
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
