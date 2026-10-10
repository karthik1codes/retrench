import { promises as fs } from "fs";
import path from "path";
import { env, useMockData } from "./config";
import { hasCfoCreds } from "./cfo";
import {
  getProject,
  hasNeatlogsIngestKey,
  hasNeatlogsServiceToken,
  listTraces,
} from "./neatlogs";

export type IntegrationStatus = {
  id: "neatlogs" | "entire" | "cfo" | "mock";
  label: string;
  ok: boolean;
  detail: string;
  nextStep?: string;
};

export type SetupReport = {
  mock: boolean;
  readyForLive: boolean;
  integrations: IntegrationStatus[];
  checkedAt: string;
};

async function entireStatus(): Promise<IntegrationStatus> {
  const repoRoot = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    env("ENTIRE_REPO_PATH", "..")
  );
  const entireDir = path.join(/* turbopackIgnore: true */ repoRoot, ".entire");
  try {
    await fs.access(entireDir);
    const files = await walkJsonCount(entireDir, 20);
    if (files === 0) {
      return {
        id: "entire",
        label: "entire.io",
        ok: false,
        detail: `.entire exists at ${entireDir} but no checkpoint JSON yet`,
        nextStep:
          "Make a coding-agent commit after `entire enable --agent cursor`",
      };
    }
    return {
      id: "entire",
      label: "entire.io",
      ok: true,
      detail: `${files} checkpoint file(s) under .entire`,
    };
  } catch {
    return {
      id: "entire",
      label: "entire.io",
      ok: false,
      detail: "Entire not initialized in this repo",
      nextStep: "From repo root: entire enable --agent cursor",
    };
  }
}

async function walkJsonCount(dir: string, limit: number): Promise<number> {
  let count = 0;
  async function walk(current: string) {
    if (count >= limit) return;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && e.name.endsWith(".json")) count += 1;
      if (count >= limit) return;
    }
  }
  await walk(dir);
  return count;
}

async function neatlogsStatus(): Promise<IntegrationStatus> {
  const projectId = env("NEATLOGS_PROJECT_ID");
  if (!projectId) {
    return {
      id: "neatlogs",
      label: "neatlogs",
      ok: false,
      detail: "NEATLOGS_PROJECT_ID empty",
      nextStep: "Set project UUID d6852d79-66eb-4731-af1e-2e0895230d77",
    };
  }

  if (!hasNeatlogsServiceToken() && !hasNeatlogsIngestKey()) {
    return {
      id: "neatlogs",
      label: "neatlogs",
      ok: false,
      detail: "No neatlogs credentials in web/.env.local",
      nextStep:
        "Add NEATLOGS_TOKEN (service account for reads) + keep NEATLOGS_API_KEY for agent ingest",
    };
  }

  if (!hasNeatlogsServiceToken()) {
    return {
      id: "neatlogs",
      label: "neatlogs",
      ok: false,
      detail:
        "Ingest key present (agent traces work) but Public API reads need a service-account token",
      nextStep:
        "app.neatlogs.com → Settings → Service Accounts → mint token (observability:read) → NEATLOGS_TOKEN in web/.env.local → restart dev",
    };
  }

  try {
    await getProject();
    const traces = await listTraces(5);
    return {
      id: "neatlogs",
      label: "neatlogs",
      ok: true,
      detail: `Public API OK · ${traces.length} recent trace(s) · project ${projectId.slice(0, 8)}…`,
    };
  } catch (e) {
    return {
      id: "neatlogs",
      label: "neatlogs",
      ok: false,
      detail: e instanceof Error ? e.message : "neatlogs request failed",
      nextStep:
        "Re-mint service-account token bound to this project with observability:read",
    };
  }
}

function cfoStatus(): IntegrationStatus {
  if (!hasCfoCreds()) {
    return {
      id: "cfo",
      label: "cfo.ai",
      ok: false,
      detail:
        "No CFO_AI_ACCESS_TOKEN — using local deterministic unit-economics",
      nextStep: "Connect Ari MCP and set CFO_AI_ACCESS_TOKEN (+ optional ORG_ID)",
    };
  }
  return {
    id: "cfo",
    label: "cfo.ai",
    ok: true,
    detail: `Token set · MCP ${env("CFO_AI_MCP_URL", "https://api.cfo.ai/mcp")}`,
  };
}

export async function getSetupReport(): Promise<SetupReport> {
  const mock = useMockData();
  const [neatlogs, entire] = await Promise.all([
    neatlogsStatus(),
    entireStatus(),
  ]);
  const cfo = cfoStatus();
  const integrations: IntegrationStatus[] = [
    neatlogs,
    entire,
    cfo,
    {
      id: "mock",
      label: "data mode",
      ok: !mock,
      detail: mock
        ? "USE_MOCK_DATA=true — full demo story without live pulls"
        : "USE_MOCK_DATA=false — hybrid live enrichment on",
      nextStep: mock
        ? "Set USE_MOCK_DATA=false in web/.env.local after integrations are green"
        : undefined,
    },
  ];

  return {
    mock,
    readyForLive: neatlogs.ok && entire.ok,
    integrations,
    checkedAt: new Date().toISOString(),
  };
}
