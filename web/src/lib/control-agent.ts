import {
  readAgentState,
  writeAgentState,
  writeFixBrief,
  type ControlAgentState,
  type DecisionChoice,
  type FeatureAgentState,
} from "./agent-store";
import {
  decideKeepFixKill,
  investigate,
  listFeatures,
} from "./retrench";
import { listFeatureTraces } from "./neatlogs";

const ERROR_CLIFF = 0.35; // >35% ERROR in recent sample → cliff
const WATCHDOG_TARGET = 0.8;

export type TickResult = {
  state: ControlAgentState;
  tick: ControlAgentState["recentTicks"][number];
};

/**
 * One autonomous control-agent cycle:
 * Watch → Investigate → Decide → Act → (Watchdog if verifying)
 */
export async function runControlAgentTick(): Promise<TickResult> {
  const { features } = await listFeatures();
  const state = await readAgentState();
  const decisions: DecisionChoice[] = [];
  let cliffs = 0;

  for (const feature of features) {
    const brief = await investigate(feature.id);
    if (!brief) continue;

    const traces = brief.runtime.liveTraces ?? [];
    const ok = traces.filter((t) => (t.status || "").toUpperCase() === "OK")
      .length;
    const err = traces.filter((t) => (t.status || "").toUpperCase() === "ERROR")
      .length;
    const liveRate =
      traces.length > 0 ? ok / traces.length : brief.runtime.successRate;
    const cliff =
      feature.status === "regress" ||
      (traces.length > 0 && err / traces.length >= ERROR_CLIFF) ||
      liveRate < WATCHDOG_TARGET;

    if (cliff) cliffs += 1;

    const decision = decideKeepFixKill({
      ...brief,
      decision: brief.decision,
    });
    decisions.push(decision);

    let fixBriefPath: string | undefined;
    let paused = state.features[feature.id]?.paused ?? false;

    if (decision === "fix" && cliff) {
      fixBriefPath = await writeFixBrief({
        featureId: feature.id,
        featureName: feature.name,
        brief: brief.fixBrief,
        decision,
        traceIds: brief.runtime.traceIds,
      });
      state.briefs.unshift({
        featureId: feature.id,
        path: fixBriefPath,
        at: new Date().toISOString(),
      });
      state.briefs = state.briefs.slice(0, 20);
    }

    if (decision === "kill" && cliff) {
      paused = true;
    }
    if (decision === "keep") {
      paused = false;
    }

    const existing = state.features[feature.id];
    let watchdog = existing?.watchdog;

    if (decision === "fix" && cliff) {
      watchdog = {
        active: true,
        startedAt: new Date().toISOString(),
        targetSuccessRate: WATCHDOG_TARGET,
        detail: "Watchdog armed — waiting for post-fix neatlogs verification",
      };
    }

    if (watchdog?.active) {
      watchdog = await runWatchdogCheck(feature.id, watchdog);
    }

    const entry: FeatureAgentState = {
      featureId: feature.id,
      featureName: feature.name,
      decision,
      reason: brief.runtime.soWhat ?? brief.fixBrief,
      fixBrief: brief.fixBrief,
      paused,
      cliff,
      liveSuccessRate: liveRate,
      errorTraces: err,
      okTraces: ok,
      atRiskPerDay: brief.money.lostContributionPerDay,
      decidedAt: new Date().toISOString(),
      watchdog,
    };
    state.features[feature.id] = entry;
  }

  const tick = {
    at: new Date().toISOString(),
    featuresChecked: features.length,
    cliffs,
    decisions,
    summary:
      cliffs > 0
        ? `Detected ${cliffs} cliff(s). Decisions: ${decisions.join(", ") || "none"}.`
        : `No cliffs. Portfolio healthy across ${features.length} feature(s).`,
  };
  state.lastTickAt = tick.at;
  state.recentTicks = [tick, ...state.recentTicks].slice(0, 30);

  const saved = await writeAgentState(state);
  return { state: saved, tick };
}

async function runWatchdogCheck(
  featureId: string,
  watchdog: NonNullable<FeatureAgentState["watchdog"]>
) {
  const hint =
    featureId === "checkout-recovery" ? "checkout-recovery" : featureId;
  try {
    const traces = await listFeatureTraces(hint, 10);
    const ok = traces.filter((t) => (t.status || "").toUpperCase() === "OK")
      .length;
    const rate = traces.length ? ok / traces.length : 0;
    const passed = traces.length > 0 && rate >= watchdog.targetSuccessRate;
    return {
      ...watchdog,
      lastCheckAt: new Date().toISOString(),
      ok: passed,
      active: !passed,
      detail: passed
        ? `Watchdog PASSED — ${(rate * 100).toFixed(0)}% OK on ${traces.length} recent traces (≥ ${(watchdog.targetSuccessRate * 100).toFixed(0)}%)`
        : `Watchdog WAITING — ${(rate * 100).toFixed(0)}% OK on ${traces.length} traces (need ≥ ${(watchdog.targetSuccessRate * 100).toFixed(0)}%)`,
    };
  } catch (e) {
    return {
      ...watchdog,
      lastCheckAt: new Date().toISOString(),
      ok: false,
      detail: `Watchdog error: ${e instanceof Error ? e.message : "unknown"}`,
    };
  }
}

export async function runWatchdogOnly(featureId: string) {
  const state = await readAgentState();
  const current = state.features[featureId];
  if (!current) {
    throw new Error(`No control-agent state for ${featureId} — run a tick first`);
  }
  const watchdog = current.watchdog ?? {
    active: true,
    startedAt: new Date().toISOString(),
    targetSuccessRate: WATCHDOG_TARGET,
    detail: "Watchdog started manually",
  };
  current.watchdog = await runWatchdogCheck(featureId, {
    ...watchdog,
    active: true,
  });
  state.features[featureId] = current;
  return writeAgentState(state);
}
