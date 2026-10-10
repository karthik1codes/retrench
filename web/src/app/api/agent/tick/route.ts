import { NextResponse } from "next/server";
import { runControlAgentTick } from "@/lib/control-agent";

export const dynamic = "force-dynamic";

/** Autonomous control-agent cycle — Watch → Investigate → Decide → Act → Watchdog */
export async function POST() {
  try {
    const result = await runControlAgentTick();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "tick failed",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
