import { promises as fs } from "fs";
import path from "path";

export type DecisionChoice = "keep" | "fix" | "kill";

export type WatchdogState = {
  active: boolean;
  startedAt: string;
  lastCheckAt?: string;
  ok?: boolean;
  detail: string;
  targetSuccessRate: number;
};

export type FeatureAgentState = {
  featureId: string;
  featureName: string;
  decision: DecisionChoice;
  reason: string;
  fixBrief?: string;
  paused: boolean;
  cliff: boolean;
  liveSuccessRate?: number;
  errorTraces: number;
  okTraces: number;
  atRiskPerDay?: number;
  decidedAt: string;
  watchdog?: WatchdogState;
};

export type AgentTickRun = {
  at: string;
  featuresChecked: number;
  cliffs: number;
  decisions: DecisionChoice[];
  summary: string;
};

export type ControlAgentState = {
  version: 1;
  updatedAt: string;
  lastTickAt?: string;
  features: Record<string, FeatureAgentState>;
  recentTicks: AgentTickRun[];
  briefs: { featureId: string; path: string; at: string }[];
};

const STATE_DIR = () =>
  path.join(/* turbopackIgnore: true */ process.cwd(), ".retrench");
const STATE_FILE = () => path.join(STATE_DIR(), "control-agent-state.json");
const BRIEFS_DIR = () => path.join(STATE_DIR(), "briefs");

function emptyState(): ControlAgentState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    features: {},
    recentTicks: [],
    briefs: [],
  };
}

export async function readAgentState(): Promise<ControlAgentState> {
  try {
    const raw = await fs.readFile(STATE_FILE(), "utf8");
    return JSON.parse(raw) as ControlAgentState;
  } catch {
    return emptyState();
  }
}

export async function writeAgentState(
  state: ControlAgentState
): Promise<ControlAgentState> {
  await fs.mkdir(STATE_DIR(), { recursive: true });
  const next = { ...state, updatedAt: new Date().toISOString() };
  await fs.writeFile(STATE_FILE(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function writeFixBrief(input: {
  featureId: string;
  featureName: string;
  brief: string;
  decision: DecisionChoice;
  traceIds: string[];
}): Promise<string> {
  await fs.mkdir(BRIEFS_DIR(), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(BRIEFS_DIR(), `${input.featureId}-${stamp}.md`);
  const body = `# Fix brief — ${input.featureName}

**Decision:** ${input.decision.toUpperCase()}  
**Generated:** ${new Date().toISOString()}  
**For:** coding agent (Cursor / Claude Code / Codex)

## Brief

${input.brief}

## neatlogs evidence

${input.traceIds.map((id) => `- \`${id}\``).join("\n") || "- (none)"}

## Acceptance (Watchdog)

- Success rate ≥ 80% on recent checkout_agent traces  
- Cost / success ≤ $0.80 (modeled)  
- Failure class cleared in neatlogs  

Hand this file to your coding agent, apply the patch, commit (Entire checkpoint), then run Watchdog.
`;
  await fs.writeFile(file, body, "utf8");
  return file;
}
