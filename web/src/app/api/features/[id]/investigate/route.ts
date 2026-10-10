import { NextResponse } from "next/server";
import { decideKeepFixKill, investigate } from "@/lib/retrench";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const brief = await investigate(id);
  if (!brief) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...brief,
    decision: decideKeepFixKill(brief),
  });
}
