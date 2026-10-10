import { NextResponse } from "next/server";
import { getFeature } from "@/lib/retrench";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const feature = await getFeature(id);
  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }
  return NextResponse.json({ feature });
}
