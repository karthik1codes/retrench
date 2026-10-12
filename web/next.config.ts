import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep deploys unblocked; lint locally / in CI separately.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
