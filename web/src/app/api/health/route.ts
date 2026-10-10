import { NextResponse } from "next/server";
import { getSetupReport } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function GET() {
  const setup = await getSetupReport();
  return NextResponse.json({
    ok: true,
    service: "retrench",
    ts: new Date().toISOString(),
    mock: setup.mock,
    readyForLive: setup.readyForLive,
    integrations: Object.fromEntries(
      setup.integrations.map((i) => [i.id, { ok: i.ok, detail: i.detail }])
    ),
  });
}
