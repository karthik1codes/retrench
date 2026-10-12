"use client";

import { LoaderIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const SCOUT_FLOW_STEPS = [
  {
    title: "Search",
    detail: "Resolve the company and pull live profile signals.",
  },
  {
    title: "Draft",
    detail: "Pick a signal and edit the evidence-backed draft.",
  },
  {
    title: "Send",
    detail: "Choose a recipient and prepare the message.",
  },
  {
    title: "Mail",
    detail: "Open your mail client — Scout never sends for you.",
  },
] as const;

type ScoutFlowStepperProps = {
  current: number;
  onStepChange?: (step: number) => void;
  searching?: boolean;
  className?: string;
};

/** Compact workflow tabs — meant for the scout toolbar, not a separate card. */
export function ScoutFlowStepper({
  current,
  onStepChange,
  searching = false,
  className,
}: ScoutFlowStepperProps) {
  const steps = SCOUT_FLOW_STEPS;
  const active = Math.min(Math.max(current, 1), steps.length);

  return (
    <Tabs
      value={String(active)}
      onValueChange={(value) => {
        const next = Number(value);
        if (!Number.isFinite(next)) return;
        onStepChange?.(next);
      }}
      className={cn("w-full max-w-md gap-0", className)}
      aria-label="Scout workflow"
    >
      <TabsList className="grid h-8 w-full grid-cols-4">
        {steps.map((item, index) => {
          const step = index + 1;
          return (
            <TabsTrigger
              key={item.title}
              value={String(step)}
              className="gap-1 px-1 text-xs"
            >
              {step === 1 && searching ? (
                <LoaderIcon className="size-3 animate-spin" aria-hidden />
              ) : null}
              {item.title}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
