import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

const googleId = process.env.AUTH_GOOGLE_ID?.trim();
const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim();

type TokenBag = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

async function refresh(token: TokenBag): Promise<TokenBag | null> {
  if (!token.refreshToken || !googleId || !googleSecret) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleId,
      client_secret: googleSecret,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };
  if (!res.ok || !data.access_token) return null;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || token.refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
  };
}

export async function resolveGmailAccessToken(
  req: NextRequest,
): Promise<string | null> {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });
  if (!token) return null;

  let accessToken = token.accessToken as string | undefined;
  let refreshToken = token.refreshToken as string | undefined;
  let expiresAt = token.expiresAt as number | undefined;

  if (
    accessToken &&
    expiresAt &&
    Date.now() / 1000 < expiresAt - 60
  ) {
    return accessToken;
  }

  const refreshed = await refresh({ accessToken, refreshToken, expiresAt });
  return refreshed?.accessToken || accessToken || null;
}

function encodeRawMessage(opts: {
  to: string;
  subject: string;
  body: string;
  from?: string;
}) {
  const lines = [
    `To: ${opts.to}`,
    opts.from ? `From: ${opts.from}` : null,
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    opts.body,
  ].filter((x) => x != null) as string[];
  const raw = lines.join("\r\n");
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function gmailSend(opts: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string; threadId?: string }> {
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: encodeRawMessage(opts),
      }),
    },
  );
  const data = (await res.json()) as {
    id?: string;
    threadId?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || `Gmail send failed (${res.status})`);
  }
  return { id: data.id, threadId: data.threadId };
}

export type SentMatch = {
  id: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
};

/** Search Gmail Sent for a recent message matching to + subject. */
export async function gmailFindInSent(opts: {
  accessToken: string;
  to: string;
  subject: string;
  afterUnixSeconds?: number;
}): Promise<SentMatch | null> {
  const toAddr = opts.to.trim().toLowerCase();
  const subj = opts.subject.trim().replace(/"/g, "");
  const after = opts.afterUnixSeconds
    ? ` after:${opts.afterUnixSeconds}`
    : "";
  const q = `in:sent to:${toAddr} subject:"${subj}"${after}`.trim();

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${opts.accessToken}` } },
  );
  const list = (await listRes.json()) as {
    messages?: { id: string; threadId?: string }[];
    error?: { message?: string };
  };
  if (!listRes.ok) {
    throw new Error(list.error?.message || `Gmail search failed (${listRes.status})`);
  }
  const first = list.messages?.[0];
  if (!first) return null;

  const getRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${first.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=To`,
    { headers: { Authorization: `Bearer ${opts.accessToken}` } },
  );
  const msg = (await getRes.json()) as {
    id?: string;
    threadId?: string;
    snippet?: string;
    internalDate?: string;
  };
  if (!getRes.ok || !msg.id) return null;
  return {
    id: msg.id,
    threadId: msg.threadId,
    snippet: msg.snippet,
    internalDate: msg.internalDate,
  };
}
