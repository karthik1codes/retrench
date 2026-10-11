import { NextResponse } from "next/server";

/** SMTP path removed — use Open in Gmail after Google sign-in. */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Use Open in Gmail after signing in with Google. Server SMTP is disabled.",
    },
    { status: 410 },
  );
}
