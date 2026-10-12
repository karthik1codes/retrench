import { NextResponse } from "next/server";
import { logDraftAction } from "@/lib/scout-agent";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      draft_id?: string;
      signal_id?: string;
      company?: string;
      domain?: string;
      subject?: string;
      body?: string;
    };
    const action = String(body.action || "").toLowerCase();
    if (!["approve", "edit", "reject"].includes(action)) {
      return NextResponse.json(
        { status: "failed", error: "action must be approve|edit|reject" },
        { status: 400 },
      );
    }
    const result = await logDraftAction({
      action: action as "approve" | "edit" | "reject",
      draft_id: body.draft_id,
      signal_id: body.signal_id,
      company: body.company,
      domain: body.domain,
      subject: body.subject,
      body: body.body,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        status: "failed",
        error: e instanceof Error ? e.message : "draft-action failed",
      },
      { status: 500 },
    );
  }
}
