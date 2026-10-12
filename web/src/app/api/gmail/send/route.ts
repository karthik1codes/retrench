import { NextRequest, NextResponse } from "next/server";
import { gmailSend, resolveGmailAccessToken } from "@/lib/gmail";

export async function POST(req: NextRequest) {
  try {
    const accessToken = await resolveGmailAccessToken(req);
    if (!accessToken) {
      return NextResponse.json(
        {
          status: "unauthorized",
          error:
            "Gmail not connected. Sign out and sign in with Google to grant send access.",
        },
        { status: 401 },
      );
    }

    const body = (await req.json()) as {
      to?: string;
      subject?: string;
      body?: string;
    };
    const to = String(body.to || "").trim();
    const subject = String(body.subject || "").trim() || "Quick note";
    const text = String(body.body || "").trim();
    if (!to || !text) {
      return NextResponse.json(
        { status: "failed", error: "to and body required" },
        { status: 400 },
      );
    }

    const sent = await gmailSend({
      accessToken,
      to,
      subject,
      body: text,
    });

    return NextResponse.json({
      status: "ok",
      id: sent.id,
      threadId: sent.threadId,
    });
  } catch (e) {
    return NextResponse.json(
      {
        status: "failed",
        error: e instanceof Error ? e.message : "gmail send failed",
      },
      { status: 500 },
    );
  }
}
