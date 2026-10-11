import { NextResponse } from "next/server";
import { fetchOverview } from "@/lib/overview";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const data = await fetchOverview();
  const code = data.status === "failed" ? 502 : 200;
  return NextResponse.json(data, { status: code });
}
