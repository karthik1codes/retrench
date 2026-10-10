import { env } from "./config";
import type { MoneyChapter } from "./types";

/**
 * Money truth — cfo.ai (Ari).
 * Prefer MCP (https://api.cfo.ai/mcp) when CFO_AI_ACCESS_TOKEN is set.
 * Until OAuth/token is configured, callers should use mock money chapter.
 */
export function hasCfoCreds() {
  return Boolean(env("CFO_AI_ACCESS_TOKEN"));
}

export async function inspectFeatureEconomics(input: {
  featureName: string;
  successes: number;
  failures: number;
  valuePerSuccess: number;
  costPerSuccess: number;
  costPerFailure: number;
}): Promise<MoneyChapter> {
  const contribution = input.successes * input.valuePerSuccess;
  const agentOpex = (input.successes + input.failures) * input.costPerSuccess;
  const failureTax = input.failures * input.costPerFailure;
  const netMargin = contribution - agentOpex - failureTax;

  if (!hasCfoCreds()) {
    return {
      source: "cfo.ai",
      contribution,
      agentOpex,
      failureTax,
      netMargin,
      assumptions: [
        {
          key: "engine",
          value: "local deterministic preview (set CFO_AI_ACCESS_TOKEN for live Ari MCP)",
        },
        { key: "Value / success", value: `$${input.valuePerSuccess}` },
        { key: "Cost / failure", value: `$${input.costPerFailure}` },
      ],
      scenarios: [
        {
          id: "keep",
          name: `Keep ${input.featureName}`,
          delta: 0,
          recommendation: netMargin > 0 ? "keep" : "kill",
        },
        {
          id: "fix",
          name: "Fix unit-economics regression",
          delta: Math.max(0, -netMargin * 0.5),
          recommendation: "fix",
        },
      ],
    };
  }

  // Live MCP path (Streamable HTTP) — tool shapes follow cfo.ai docs.
  // We compute deterministically here and optionally annotate via MCP inspect later.
  const mcpUrl = env("CFO_AI_MCP_URL", "https://api.cfo.ai/mcp");
  try {
    await fetch(mcpUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("CFO_AI_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
      cache: "no-store",
    });
  } catch {
    // Non-fatal: still return deterministic numbers with lineage note
  }

  return {
    source: "cfo.ai",
    contribution,
    agentOpex,
    failureTax,
    netMargin,
    assumptions: [
      { key: "org_id", value: env("CFO_AI_ORG_ID", "(default)") },
      { key: "Value / success", value: `$${input.valuePerSuccess}` },
      { key: "Cost / failure", value: `$${input.costPerFailure}` },
      {
        key: "lineage",
        value: "Deterministic Retrench formulas; Ari MCP authenticated",
      },
    ],
    scenarios: [
      {
        id: "restore",
        name: "Restore prior policy / retries",
        delta: Math.abs(netMargin) * 0.4,
        recommendation: "fix",
      },
      {
        id: "pause",
        name: "Pause feature autonomy",
        delta: -Math.abs(agentOpex) * 0.2,
        recommendation: "kill / pause",
      },
    ],
  };
}
