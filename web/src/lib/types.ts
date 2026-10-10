export type FeatureStatus =
  | "healthy"
  | "watch"
  | "regress"
  | "investigating"
  | "fixing"
  | "verifying"
  | "paused";

export type Feature = {
  id: string;
  name: string;
  agents: string[];
  status: FeatureStatus;
  netContrib7d: number;
  netContribDelta: number;
  costPerSuccess: number;
  successRate: number;
  attempts7d: number;
  driver: string;
  valuePerSuccess: number;
  costPerFailure: number;
};

export type RuntimeChapter = {
  source: "neatlogs";
  successRate: number;
  costPerSuccess: number;
  openIncidents: { id: string; title: string; failingRuns: number }[];
  evidenceSpans: string[];
  traceIds: string[];
  /** Structured live traces for UI (neatlogs Public API). */
  liveTraces?: {
    id: string;
    status?: string;
    name?: string;
    createdAt?: string;
  }[];
  /** Plain-language “so what” for PMs / finance. */
  soWhat?: string;
};

export type ChangeChapter = {
  source: "entire.io";
  commit?: string;
  sessionId?: string;
  summary: string;
  filesTouched: string[];
  checkpointPath?: string;
};

export type MoneyChapter = {
  source: "cfo.ai";
  contribution: number;
  agentOpex: number;
  failureTax: number;
  netMargin: number;
  lostContributionPerDay?: number;
  assumptions: { key: string; value: string }[];
  scenarios: { id: string; name: string; delta: number; recommendation: string }[];
};

export type InvestigateBrief = {
  feature: Feature;
  runtime: RuntimeChapter;
  change: ChangeChapter;
  money: MoneyChapter;
  decision: "keep" | "fix" | "kill";
  fixBrief: string;
};
