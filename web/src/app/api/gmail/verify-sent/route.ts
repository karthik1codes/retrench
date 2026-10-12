import { NextRequest, NextResponse } from "next/server";
import { gmailFindInSent, resolveGmailAccessToken } from "@/lib/gmail";

export async function POST(req: NextRequest) {
  try {
    const accessToken = await resolveGmailAccessToken(req);
    if (!accessToken) {
      return NextResponse.json(
        {
          status: "unauthorized",
          error:
            "Gmail not connected. Sign out and sign in with Google to grant Sent access.",
        },
        { status: 401 },
      );
    }

    const body = (await req.json()) as {
      to?: string;
      subject?: string;
      afterUnixSeconds?: number;
    };
    const to = String(body.to || "").trim();
    const subject = String(body.subject || "").trim();
    if (!to || !subject) {
      return NextResponse.json(
        { status: "failed", error: "to and subject required" },
        { status: 400 },
      );
    }

    const match = await gmailFindInSent({
      accessToken,
      to,
      subject,
      afterUnixSeconds: body.afterUnixSeconds,
    });

    return NextResponse.json({
      status: "ok",
      verified: Boolean(match),
      match,
    });
  } catch (e) {
    return NextResponse.json(
      {
        status: "failed",
        error: e instanceof Error ? e.message : "verify-sent failed",
      },
      { status: 500 },
    );
  }
}
