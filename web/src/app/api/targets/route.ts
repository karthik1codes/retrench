import { NextResponse } from "next/server";
import { fetchTargets } from "@/lib/targets";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 15;

export async function GET() {
  const data = await fetchTargets();
  // Soft-fail: always 200 so Scout can show an empty state when the agent is down.
  // status "unavailable" / error message carries the real cause.
  return NextResponse.json(data, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
}
