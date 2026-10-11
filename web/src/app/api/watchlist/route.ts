import { NextResponse } from "next/server";
import { DEMO_SIGNALS, SEGMENT } from "../../../data/signals";

/** Product API — demo fixtures today; swap for Neo4j / digest files on EC2. */
export async function GET() {
  return NextResponse.json({
    segment: SEGMENT,
    generated_at: new Date().toISOString(),
    signals: DEMO_SIGNALS,
  });
}
