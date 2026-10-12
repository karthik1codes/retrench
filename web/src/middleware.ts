export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    "/scout/:path*",
    "/watchlist/:path*",
    "/dashboard/:path*",
    "/sent/:path*",
    "/follow-ups/:path*",
  ],
};
