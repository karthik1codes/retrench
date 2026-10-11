import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const googleId = process.env.AUTH_GOOGLE_ID?.trim();
const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim();

export const googleConfigured = Boolean(googleId && googleSecret);

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers: googleConfigured
    ? [
        Google({
          clientId: googleId!,
          clientSecret: googleSecret!,
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
        pathname.startsWith("/dashboard");
      // Landing `/` stays public (gtm.ai-style marketing).
      if (!isApp) return true;
      return !!auth?.user;
    },
    async jwt({ token, account, profile }) {
      if (account) token.accessToken = account.access_token;
      if (profile && "picture" in profile) {
        token.picture = profile.picture as string | undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.image = (token.picture as string) || session.user.image;
      }
      return session;
    },
  },
  trustHost: true,
});
