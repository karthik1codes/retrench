import { NextResponse } from "next/server";
import { listFeatures } from "@/lib/retrench";

export async function GET() {
  const data = await listFeatures();
  return NextResponse.json(data);
}
