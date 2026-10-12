"use client";

import { CheckIcon } from "lucide-react";
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperTitle,
  StepperTrigger,
} from "@/components/reui/stepper";
import { cn } from "@/lib/utils";

export const SCOUT_FLOW_STEPS = [
  {
    title: "Searching",
    detail: "Resolve the company and pull live profile signals.",
  },
  {
    title: "Drafting",
    detail: "Pick a signal and edit the evidence-backed draft.",
  },
  {
    title: "Send",
    detail: "Choose a recipient and prepare the message.",
  },
  {
    title: "Sending",
    detail: "Open your mail client — Scout never sends for you.",
  },
] as const;

const completed = <CheckIcon className="size-2.5" aria-hidden="true" />;

type ScoutFlowStepperProps = {
  current: number;
  onStepChange?: (step: number) => void;
  searching?: boolean;
  className?: string;
};

/** Compact horizontal progress — company panel stays visible; drafts slide separately. */
export function ScoutFlowStepper({
  current,
  onStepChange,
  searching = false,
  className,
}: ScoutFlowStepperProps) {
  const steps = SCOUT_FLOW_STEPS;
  const active = Math.min(Math.max(current, 1), steps.length);
  const detail =
    searching && active === 1
      ? "Scouting the company now…"
      : current > steps.length
        ? "Mail compose opened. Scout another company anytime."
        : steps[active - 1]?.detail;

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <Stepper
        value={current}
        onValueChange={onStepChange}
        orientation="horizontal"
        indicators={{ completed }}
        className="w-full"
        aria-label="Scout workflow"
      >
        <StepperNav className="gap-1 sm:gap-2">
          {steps.map((item, index) => {
            const step = index + 1;
            return (
              <StepperItem
                key={item.title}
                step={step}
                loading={step === 1 && searching}
                className="flex-1"
              >
                <StepperTrigger className="w-full flex-col gap-1 rounded-lg px-1 py-2 sm:flex-row sm:items-center sm:gap-2 sm:px-2">
                  <StepperIndicator className="size-7 shrink-0" />
                  <StepperTitle className="truncate text-[11px] font-medium sm:text-xs">
                    {item.title}
                  </StepperTitle>
                </StepperTrigger>
              </StepperItem>
            );
          })}
        </StepperNav>
      </Stepper>
      {detail ? (
        <p className="text-xs text-pretty text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}
