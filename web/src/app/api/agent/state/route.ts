import { NextResponse } from "next/server";
import { readAgentState } from "@/lib/agent-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await readAgentState();
  return NextResponse.json(state);
}
