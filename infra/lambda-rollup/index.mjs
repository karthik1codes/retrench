/**
 * Hackathon Lambda — kick Retrench rollup + autonomous control-agent tick.
 * Env: RETRENCH_BASE_URL=https://<alb-or-ec2-host>
 * Memory: 128–256 MB · timeout: 30s · Node 20
 * EventBridge: rate(15 minutes)
 */
export async function handler() {
  const base = (process.env.RETRENCH_BASE_URL || "").replace(/\/$/, "");
  if (!base) {
    throw new Error("RETRENCH_BASE_URL is required");
  }

  const results = {};
  for (const path of ["/api/features", "/api/agent/tick"]) {
    const url = `${base}${path}`;
    const res = await fetch(url, {
      method: path.endsWith("/tick") ? "POST" : "GET",
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${path} failed ${res.status}: ${text.slice(0, 200)}`);
    }
    results[path] = { status: res.status, bytes: text.length };
  }

  return {
    ok: true,
    results,
    at: new Date().toISOString(),
  };
}
