import { promises as fs } from "fs";
import path from "path";
import { env } from "./config";

export type EntireCheckpoint = {
  commit?: string;
  sessionId?: string;
  summary: string;
  filesTouched: string[];
  checkpointPath?: string;
};

/**
 * Change truth — read Entire checkpoints from the repo.
 * Expects `entire enable` to have created `.entire/` locally.
 * Falls back gracefully when Entire is not initialized yet.
 */
export async function latestCheckpoint(
  hintFiles: string[] = []
): Promise<EntireCheckpoint> {
  const repoRoot = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    env("ENTIRE_REPO_PATH", "..")
  );
  const entireDir = path.join(
    /* turbopackIgnore: true */ repoRoot,
    ".entire"
  );

  try {
    await fs.access(entireDir);
  } catch {
    return {
      summary:
        "Entire not initialized in this repo. Run `entire enable --agent cursor` then commit via a coding agent.",
      filesTouched: hintFiles,
    };
  }

  // Best-effort scan for recent checkpoint metadata JSON files
  const candidates = await walkJson(entireDir, 40);
  if (candidates.length === 0) {
    return {
      summary:
        "Entire is enabled but no checkpoint metadata found yet. Make a coding-agent commit to create one.",
      filesTouched: hintFiles,
      checkpointPath: entireDir,
    };
  }

  const newest = candidates.sort((a, b) => b.mtime - a.mtime)[0];
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(await fs.readFile(newest.path, "utf8"));
  } catch {
    parsed = {};
  }

  return {
    commit: str(parsed.commit ?? parsed.sha ?? parsed.git_commit),
    sessionId: str(parsed.sessionId ?? parsed.session_id ?? parsed.id),
    summary:
      str(parsed.summary ?? parsed.message ?? parsed.prompt) ||
      `Entire checkpoint at ${path.relative(repoRoot, newest.path)}`,
    filesTouched:
      (parsed.files as string[]) ||
      (parsed.changed_files as string[]) ||
      hintFiles,
    checkpointPath: newest.path,
  };
}

function str(v: unknown) {
  return v == null ? undefined : String(v);
}

async function walkJson(
  dir: string,
  limit: number
): Promise<{ path: string; mtime: number }[]> {
  const out: { path: string; mtime: number }[] = [];
  async function walk(current: string) {
    if (out.length >= limit) return;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && e.name.endsWith(".json")) {
        const st = await fs.stat(full);
        out.push({ path: full, mtime: st.mtimeMs });
      }
    }
  }
  await walk(dir);
  return out;
}
