/**
 * Probe neatlogs Public API using web/.env.local (no secrets printed).
 * Usage: node scripts/probe-neatlogs.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
const raw = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const token = env.NEATLOGS_TOKEN || env.NEATLOGS_API_KEY;
const projectId = env.NEATLOGS_PROJECT_ID;
const base = (env.NEATLOGS_BASE_URL || "https://app.neatlogs.com").replace(
  /\/$/,
  ""
);

if (!token) {
  console.error("FAIL: no NEATLOGS_TOKEN / NEATLOGS_API_KEY in web/.env.local");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/json",
};
if (projectId) headers["x-project-id"] = projectId;

const projectRes = await fetch(`${base}/api/v1/public/project`, { headers });
const projectBody = await projectRes.text();
console.log(
  `project: ${projectRes.status} token_prefix=${token.slice(0, 4)}… project_id_set=${Boolean(projectId)}`
);
if (!projectRes.ok) {
  console.error(projectBody.slice(0, 300));
  process.exit(1);
}

const tracesRes = await fetch(`${base}/api/v1/public/traces?limit=10`, {
  headers,
});
const tracesJson = await tracesRes.json().catch(() => null);
console.log(`traces: ${tracesRes.status}`);
if (!tracesRes.ok) {
  console.error(JSON.stringify(tracesJson).slice(0, 300));
  process.exit(1);
}

const list = tracesJson?.data?.traces ?? tracesJson?.traces ?? [];
console.log(`count: ${list.length}`);
for (const t of list.slice(0, 8)) {
  const id = t.id ?? t.traceId ?? "";
  const name = t.name ?? t.workflowName ?? t.workflow_name ?? "";
  const status = t.status ?? "";
  console.log(`- ${name || "(unnamed)"} | ${id} | ${status}`);
}
console.log("OK");
