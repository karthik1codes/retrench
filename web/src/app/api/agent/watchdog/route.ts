import { NextResponse } from "next/server";
import { runWatchdogOnly } from "@/lib/control-agent";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { featureId?: string };
    const featureId = body.featureId || "checkout-recovery";
    const state = await runWatchdogOnly(featureId);
    return NextResponse.json({
      feature: state.features[featureId],
      state,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "watchdog failed" },
      { status: 500 }
    );
  }
}
