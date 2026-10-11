import { NextResponse } from "next/server";
import { fetchDrafts } from "@/lib/scout-agent";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company") || searchParams.get("q") || "";
  if (!company.trim()) {
    return NextResponse.json({ error: "company required" }, { status: 400 });
  }
  try {
    const data = await fetchDrafts(company.trim());
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
