import { NextResponse } from "next/server";
import { findContacts } from "@/lib/scout-agent";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      domain?: string;
      company?: string;
      titles?: string[];
      verified?: boolean;
      limit?: number;
    };
    const domain = (body.domain || body.company || "").trim();
    if (!domain) {
      return NextResponse.json(
        { status: "failed", error: "domain required", contacts: [] },
        { status: 400 },
      );
    }
    const result = await findContacts({
      domain,
      titles: body.titles,
      verified: body.verified,
      limit: body.limit,
    });
    const code =
      result.status === "failed" && !result.demo ? 502 : 200;
    return NextResponse.json(result, { status: code });
  } catch (e) {
    return NextResponse.json(
      {
        status: "failed",
        error: e instanceof Error ? e.message : "contacts failed",
        contacts: [],
      },
      { status: 500 },
    );
  }
}
