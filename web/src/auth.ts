import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const googleId = process.env.AUTH_GOOGLE_ID?.trim();
const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim();

export const googleConfigured = Boolean(googleId && googleSecret);

const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

async function refreshAccessToken(token: {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  gmailScopes?: string;
  error?: string;
  picture?: string | null;
}) {
  if (!token.refreshToken || !googleId || !googleSecret) {
    return { ...token, error: "RefreshTokenMissing" };
  }
  try {
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
      error?: string;
    };
    if (!res.ok || !data.access_token) {
      return { ...token, error: data.error || "RefreshAccessTokenError" };
    }
    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
      refreshToken: data.refresh_token || token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers: googleConfigured
    ? [
        Google({
          clientId: googleId!,
          clientSecret: googleSecret!,
          authorization: {
            params: {
              scope: GMAIL_SCOPES,
              access_type: "offline",
              prompt: "consent",
              include_granted_scopes: "true",
            },
          },
        }),
      ]
    : [],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isApp =
        pathname.startsWith("/scout") ||
        pathname.startsWith("/watchlist") ||
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/sent") ||
        pathname.startsWith("/follow-ups");
      if (!isApp) return true;
      return !!auth?.user;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token || token.refreshToken;
        token.expiresAt = account.expires_at;
        token.gmailScopes = account.scope;
        token.error = undefined;
      }
      if (profile && "picture" in profile) {
        token.picture = profile.picture as string | undefined;
      }

      const expiresAt = token.expiresAt ?? 0;
      if (token.accessToken && Date.now() / 1000 < expiresAt - 60) {
        return token;
      }
      if (token.refreshToken) {
        return refreshAccessToken(token);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.image = (token.picture as string) || session.user.image;
      }
      const scopes = String(token.gmailScopes || "");
      session.gmailConnected =
        Boolean(token.accessToken) &&
        (scopes.includes("gmail.readonly") || scopes.includes("gmail.send")) &&
        !token.error;
      session.error = token.error;
      return session;
    },
  },
  trustHost: true,
});
