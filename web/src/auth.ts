import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isApp =
        pathname.startsWith("/scout") || pathname.startsWith("/watchlist");
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
