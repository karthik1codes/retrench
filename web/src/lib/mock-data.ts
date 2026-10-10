import type { Feature, InvestigateBrief } from "./types";

export const MOCK_FEATURES: Feature[] = [
  {
    id: "checkout-recovery",
    name: "Checkout Recovery",
    agents: ["checkout_agent"],
    status: "regress",
    netContrib7d: 82000,
    netContribDelta: -34000,
    costPerSuccess: 1.4,
    successRate: 0.62,
    attempts7d: 4200,
    driver: "retries removed",
    valuePerSuccess: 35.7,
    costPerFailure: 12,
  },
  {
    id: "support-refunds",
    name: "Support Refunds",
    agents: ["support_triage", "refund_agent"],
    status: "healthy",
    netContrib7d: 41000,
    netContribDelta: 2200,
    costPerSuccess: 0.22,
    successRate: 0.91,
    attempts7d: 1800,
    driver: "—",
    valuePerSuccess: 18,
    costPerFailure: 8,
  },
  {
    id: "onboarding-copilot",
    name: "Onboarding Copilot",
    agents: ["onboarding_copilot"],
    status: "watch",
    netContrib7d: 9000,
    netContribDelta: -1200,
    costPerSuccess: 0.95,
    successRate: 0.84,
    attempts7d: 960,
    driver: "retry loops",
    valuePerSuccess: 18,
    costPerFailure: 4,
  },
];

export function mockInvestigate(featureId: string): InvestigateBrief | null {
  const feature = MOCK_FEATURES.find((f) => f.id === featureId);
  if (!feature) return null;

  if (feature.id === "checkout-recovery") {
    return {
      feature,
      runtime: {
        source: "neatlogs",
        successRate: 0.62,
        costPerSuccess: 1.4,
        openIncidents: [
          {
            id: "ISS-284",
            title: "Checkout timeout after retry policy change",
            failingRuns: 218,
          },
        ],
        evidenceSpans: [
          "create_checkout returned GatewayTimeout",
          "retrieve_recovery_policy timed out",
          "duplicate charge guard still OK",
        ],
        traceIds: ["agent-run-284"],
      },
      change: {
        source: "entire.io",
        commit: "a1b2c3",
        sessionId: "cursor-session-remove-retries",
        summary: 'Coding session "remove checkout retries" shipped v2.8',
        filesTouched: [
          "checkout_agent/retry_policy.py",
          "prompts/checkout_recovery.md",
        ],
      },
      money: {
        source: "cfo.ai",
        contribution: 13300,
        agentOpex: 520,
        failureTax: 2736,
        netMargin: 10044,
        lostContributionPerDay: 4930,
        assumptions: [
          { key: "AOV", value: "$85" },
          { key: "Gross margin", value: "42% → $35.70 / success" },
          { key: "Cost per failure", value: "$12" },
          { key: "Target cost / success", value: "< $0.80" },
        ],
        scenarios: [
          {
            id: "restore-retries",
            name: "Restore bounded retries",
            delta: 4900,
            recommendation: "fix",
          },
          {
            id: "pause-feature",
            name: "Pause Checkout Recovery autonomy",
            delta: -2100,
            recommendation: "kill / pause",
          },
          {
            id: "keep-broken",
            name: "Keep v2.8 as-is",
            delta: -4930,
            recommendation: "do not keep",
          },
        ],
      },
      decision: "fix",
      fixBrief:
        "Restore two bounded retries on create_checkout (250ms backoff). Return GatewayTimeout after final retry. Keep duplicate-charge idempotency. Verify success rate ≥ 80% and cost/success ≤ $0.80 in neatlogs Watchdog.",
    };
  }

  return {
    feature,
    runtime: {
      source: "neatlogs",
      successRate: feature.successRate,
      costPerSuccess: feature.costPerSuccess,
      openIncidents: [],
      evidenceSpans: ["No critical incident open"],
      traceIds: [],
    },
    change: {
      source: "entire.io",
      summary: "No recent behavior-changing checkpoint linked to a margin cliff.",
      filesTouched: [],
    },
    money: {
      source: "cfo.ai",
      contribution: feature.netContrib7d * 0.9,
      agentOpex: feature.attempts7d * feature.costPerSuccess * 0.05,
      failureTax: feature.attempts7d * (1 - feature.successRate) * feature.costPerFailure,
      netMargin: feature.netContrib7d,
      assumptions: [
        { key: "Value / success", value: `$${feature.valuePerSuccess}` },
        { key: "Cost / failure", value: `$${feature.costPerFailure}` },
      ],
      scenarios: [
        {
          id: "keep",
          name: "Keep feature",
          delta: 0,
          recommendation: "keep",
        },
      ],
    },
    decision: feature.status === "healthy" ? "keep" : "fix",
    fixBrief: "No urgent fix brief. Continue monitoring unit economics.",
  };
}
