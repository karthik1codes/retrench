import { NextResponse } from "next/server";
import { fetchDrafts, triggerScout } from "@/lib/scout-agent";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      domain?: string;
      name?: string;
      company?: string;
    };
    let domain = (body.domain || "").trim() || undefined;
    let name = (body.name || body.company || "").trim() || undefined;

    if (!domain && !name) {
      return NextResponse.json(
        { status: "failed", error: "Provide a company domain or name" },
        { status: 400 },
      );
    }

    // Domain typed into the company field
    if (!domain && name && /^[\w.-]+\.[a-zA-Z]{2,}$/.test(name)) {
      domain = name.toLowerCase();
      name = undefined;
    }

    const result = await triggerScout({ domain, name });
    if (result.status !== "complete") {
      return NextResponse.json(result, { status: 502 });
    }

    if (result.items?.length) {
      return NextResponse.json(result);
    }

    const lookup =
      result.matched_company?.domain ||
      result.matched_company?.name ||
      domain ||
      name ||
      "";
    if (lookup) {
      const drafts = await fetchDrafts(lookup);
      return NextResponse.json({
        ...result,
        items: drafts.items,
        error: result.error || drafts.error,
      });
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        status: "failed",
        error: e instanceof Error ? e.message : "scout failed",
      },
      { status: 500 },
    );
  }
}
