import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getScoutAgentUrl } from "@/lib/agent-url";
import { emptyUserProfile, type UserProfile } from "@/lib/user-profile";

const TOKEN = process.env.SCOUT_API_TOKEN || "";

function agentHeaders(userId: string): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (TOKEN) h["X-Scout-Token"] = TOKEN;
  h["X-User-Id"] = userId;
  return h;
}

function userKeyFromSession(session: {
  user?: { email?: string | null; id?: string | null } | null;
}): string | null {
  const email = session.user?.email?.trim().toLowerCase();
  if (email) return email;
  const id = session.user?.id?.trim();
  return id || null;
}

async function readAgentProfile(userId: string): Promise<UserProfile | null> {
  const base = getScoutAgentUrl();
  if (!base) return null;
  try {
    const res = await fetch(
      `${base}/user/profile?user_id=${encodeURIComponent(userId)}`,
      {
        method: "GET",
        headers: agentHeaders(userId),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { profile?: UserProfile };
    return data.profile || null;
  } catch {
    return null;
  }
}

async function writeAgentProfile(
  userId: string,
  body: Record<string, unknown>,
): Promise<UserProfile | null> {
  const base = getScoutAgentUrl();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/user/profile`, {
      method: "PUT",
      headers: agentHeaders(userId),
      body: JSON.stringify({ ...body, user_id: userId, userId }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { profile?: UserProfile };
    return data.profile || null;
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = userKeyFromSession(session);
  if (!userId) {
    return NextResponse.json({ error: "missing user id" }, { status: 400 });
  }

  const profile =
    (await readAgentProfile(userId)) ||
    emptyUserProfile(userId);

  profile.email = session.user.email || profile.email;
  profile.name = session.user.name || profile.name;

  return NextResponse.json({
    status: "ok",
    profile,
    source: getScoutAgentUrl() ? "agent" : "local-empty",
  });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = userKeyFromSession(session);
  if (!userId) {
    return NextResponse.json({ error: "missing user id" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const payload = {
    ...body,
    user_id: userId,
    email: session.user.email || body.email,
    name: session.user.name || body.name,
  };

  const profile = await writeAgentProfile(userId, payload);
  if (!profile) {
    // Agent down — still acknowledge so UI keeps working offline on this device.
    const fallback = emptyUserProfile(userId);
    const patch =
      typeof body.profile === "object" && body.profile
        ? (body.profile as Partial<UserProfile>)
        : {};
    return NextResponse.json({
      status: "degraded",
      profile: {
        ...fallback,
        ...patch,
        userId,
        email: session.user.email || undefined,
        name: session.user.name || undefined,
        version: Number(patch.version || 0) + 1,
        updatedAt: new Date().toISOString(),
      },
      error: "scout agent unreachable — device-local only until sync resumes",
    });
  }

  return NextResponse.json({ status: "ok", profile });
}
