import { NextResponse } from "next/server";
import { getSetupReport } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function GET() {
  const setup = await getSetupReport();
  return NextResponse.json(setup);
}
