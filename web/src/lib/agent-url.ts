/**
 * Base URL for the Signal Scout HTTP agent.
 *
 * On Vercel: set SCOUT_AGENT_URL to your EC2 agent (e.g. http://IP:8787).
 * Locally: same, or http://127.0.0.1:8787.
 *
 * If/when a Vercel Services binding injects SCOUT_AGENT_URL for an internal
 * `scout` service, that value wins automatically — do not set it yourself
 * when using a binding.
 */
export function getScoutAgentUrl(): string {
  return (process.env.SCOUT_AGENT_URL || "").replace(/\/$/, "");
}
