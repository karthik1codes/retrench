import { NextResponse } from "next/server";
import { fetchDrafts, triggerScout } from "@/lib/scout-agent";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { domain?: string; name?: string; company?: string };
    const domain = (body.domain || "").trim() || undefined;
    const name = (body.name || body.company || "").trim() || undefined;

    if (!domain && !name) {
      return NextResponse.json(
        { error: "Provide a company domain or name" },
        { status: 400 },
      );
    }

    // If user typed a domain into the company field
    if (!domain && name && /^[\w.-]+\.[a-zA-Z]{2,}$/.test(name)) {
      const result = await triggerScout({ domain: name.toLowerCase() });
      if (result.status === "complete" && result.matched_company?.domain) {
        const drafts = await fetchDrafts(
          result.matched_company.domain || result.matched_company.name || name,
        );
        return NextResponse.json({ ...result, items: drafts.items });
      }
      return NextResponse.json(result);
    }

    const result = await triggerScout({ domain, name });
    const lookup =
      result.matched_company?.domain ||
      result.matched_company?.name ||
      domain ||
      name ||
      "";
    if (result.status === "complete" && lookup) {
      const drafts = await fetchDrafts(lookup);
      return NextResponse.json({ ...result, items: result.items || drafts.items });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { status: "failed", error: e instanceof Error ? e.message : "scout failed" },
      { status: 500 },
    );
  }
}
