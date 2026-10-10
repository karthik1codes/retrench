import { useMockData } from "./config";
import { inspectFeatureEconomics } from "./cfo";
import { latestCheckpoint } from "./entire";
import { getSetupReport } from "./integrations";
import { MOCK_FEATURES, mockInvestigate } from "./mock-data";
import {
  hasNeatlogsCreds,
  listFeatureTraces,
  listTraces,
} from "./neatlogs";
import type { Feature, InvestigateBrief } from "./types";

const FEATURE_WORKFLOW: Record<string, string> = {
  "checkout-recovery": "checkout-recovery",
  "support-refunds": "support-refunds",
  "onboarding-copilot": "onboarding-copilot",
};

export async function listFeatures(): Promise<{
  features: Feature[];
  sources: { neatlogs: boolean; entire: boolean; cfo: boolean; mock: boolean };
}> {
  const mock = useMockData();
  if (mock) {
    return {
      features: MOCK_FEATURES,
      sources: { neatlogs: false, entire: false, cfo: false, mock: true },
    };
  }

  const features = MOCK_FEATURES.map((f) => ({ ...f }));
  const setup = await getSetupReport();
  const neatlogsOk = setup.integrations.find((i) => i.id === "neatlogs")?.ok;
  const entireOk = setup.integrations.find((i) => i.id === "entire")?.ok;
  const cfoOk = setup.integrations.find((i) => i.id === "cfo")?.ok;

  if (hasNeatlogsCreds() && neatlogsOk) {
    try {
      const traces = await listFeatureTraces("checkout-recovery", 10);
      const checkout = features.find((f) => f.id === "checkout-recovery");
      if (checkout && traces.length) {
        const ok = traces.filter((t) => (t.status || "").toUpperCase() === "OK")
          .length;
        const err = traces.length - ok;
        checkout.driver = `checkout_agent · ${traces.length} live traces (${ok} OK / ${err} ERROR)`;
        if (err > 0) checkout.status = "regress";
      }
    } catch {
      // sources already reflect failure via setup report
    }
  }

  return {
    features,
    sources: {
      neatlogs: Boolean(neatlogsOk),
      entire: Boolean(entireOk),
      cfo: Boolean(cfoOk),
      mock: false,
    },
  };
}

export async function getFeature(id: string): Promise<Feature | null> {
  const { features } = await listFeatures();
  return features.find((f) => f.id === id) ?? null;
}

export async function investigate(id: string): Promise<InvestigateBrief | null> {
  if (useMockData()) return mockInvestigate(id);

  const feature = await getFeature(id);
  if (!feature) return null;

  const base = mockInvestigate(id);
  if (!base) return null;

  const [change, money] = await Promise.all([
    latestCheckpoint(base.change.filesTouched),
    inspectFeatureEconomics({
      featureName: feature.name,
      successes: Math.round(feature.attempts7d * feature.successRate),
      failures: Math.round(feature.attempts7d * (1 - feature.successRate)),
      valuePerSuccess: feature.valuePerSuccess,
      costPerSuccess: feature.costPerSuccess,
      costPerFailure: feature.costPerFailure,
    }),
  ]);

  let runtime = base.runtime;

  if (hasNeatlogsCreds()) {
    try {
      const hint = FEATURE_WORKFLOW[id] ?? id;
      const traces = await listFeatureTraces(hint, 20);
      const liveIds = traces.map((t) => t.id).filter(Boolean);

      if (liveIds.length) {
        const errors = traces.filter(
          (t) => (t.status || "").toUpperCase() === "ERROR"
        );
        const oks = traces.filter(
          (t) => (t.status || "").toUpperCase() === "OK"
        );

        const liveRate =
          traces.length > 0 ? oks.length / traces.length : feature.successRate;
        const atRisk = base.money.lostContributionPerDay ?? 0;
        runtime = {
          source: "neatlogs",
          successRate: liveRate,
          costPerSuccess: feature.costPerSuccess,
          openIncidents:
            errors.length > 0
              ? [
                  {
                    id: "LIVE",
                    title: `${errors.length} checkout_agent run(s) failed in production (neatlogs)`,
                    failingRuns: errors.length,
                  },
                ]
              : [],
          liveTraces: traces.slice(0, 8).map((t) => ({
            id: t.id,
            status: t.status,
            name: t.name || t.workflowName || "checkout-recovery",
            createdAt: t.createdAt,
          })),
          soWhat:
            errors.length > 0
              ? `Live checkout_agent is only ${(liveRate * 100).toFixed(0)}% OK on recent neatlogs runs. That sits under the keep line — you are paying agent OpEx while recovering fewer checkouts. At the modeled cliff this is ~$${atRisk.toLocaleString("en-US")}/day of contribution at risk until retries are restored or the feature is paused.`
              : `Recent checkout_agent runs are healthy in neatlogs (${oks.length}/${traces.length} OK). Use Money to confirm unit economics still clear the keep line.`,
          evidenceSpans: [
            `LIVE checkout_agent · ${traces.length} neatlogs trace(s) · ${oks.length} OK / ${errors.length} ERROR`,
            "Deep-dive spans (prompts, tokens, model) open in neatlogs — use the links below",
          ],
          traceIds: liveIds,
        };
      } else {
        const any = await listTraces(5);
        runtime = {
          ...base.runtime,
          evidenceSpans: [
            "neatlogs Public API OK — no checkout-recovery traces matched yet",
            any.length
              ? `${any.length} other project trace(s) present — run demo/agents/checkout_agent.py`
              : "Run: python demo/agents/checkout_agent.py",
          ],
          traceIds: [],
        };
      }
    } catch (e) {
      runtime = {
        ...base.runtime,
        evidenceSpans: [
          "Demo story evidence (live neatlogs pull failed)",
          e instanceof Error ? e.message : "neatlogs error: unknown",
        ],
      };
    }
  }

  return {
    ...base,
    feature,
    runtime,
    change: {
      source: "entire.io",
      ...change,
    },
    money,
  };
}

export function decideKeepFixKill(brief: InvestigateBrief): "keep" | "fix" | "kill" {
  if (brief.feature.status === "healthy" && brief.feature.netContribDelta >= 0) {
    return "keep";
  }
  if (
    brief.money.lostContributionPerDay &&
    brief.money.lostContributionPerDay > 3000
  ) {
    return brief.change.commit ? "fix" : "kill";
  }
  if (brief.feature.status === "regress") return "fix";
  return brief.decision;
}
