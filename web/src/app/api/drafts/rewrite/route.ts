import { NextResponse } from "next/server";
import { rewriteDraft } from "@/lib/scout-agent";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      company?: string;
      domain?: string;
      subject?: string;
      body?: string;
      signal_summary?: string;
      reason?: string;
      style_notes?: string[];
    };
    const subject = String(body.subject || "").trim();
    const text = String(body.body || "").trim();
    if (!subject && !text) {
      return NextResponse.json(
        { status: "failed", error: "subject or body required" },
        { status: 400 },
      );
    }

    const result = await rewriteDraft({
      company: body.company,
      domain: body.domain,
      subject,
      body: text,
      signal_summary: body.signal_summary,
      reason: body.reason || "spam",
      style_notes: body.style_notes,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        status: "failed",
        error: e instanceof Error ? e.message : "rewrite failed",
      },
      { status: 500 },
    );
  }
}
