import type { FeatureStatus } from "./types";

export type DecisionChoice = "keep" | "fix" | "kill";

export type RecordedDecision = {
  choice: DecisionChoice;
  at: string;
};

const KEY = "retrench:decisions:v1";

export function readDecisions(): Record<string, RecordedDecision> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, RecordedDecision>;
  } catch {
    return {};
  }
}

export function writeDecision(featureId: string, choice: DecisionChoice) {
  const next = {
    ...readDecisions(),
    [featureId]: { choice, at: new Date().toISOString() },
  };
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("retrench:decisions"));
  return next[featureId];
}

export function clearDecision(featureId: string) {
  const all = readDecisions();
  delete all[featureId];
  window.localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("retrench:decisions"));
}

export function statusFromDecision(choice: DecisionChoice): FeatureStatus {
  if (choice === "keep") return "healthy";
  if (choice === "fix") return "fixing";
  return "paused";
}
