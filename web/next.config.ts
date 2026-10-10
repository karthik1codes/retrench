import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    resolveAlias: {
      // Turbopack misses package "style"-only / bare CSS exports
      "shadcn/tailwind.css": "./node_modules/shadcn/dist/tailwind.css",
      "tw-animate-css": "./node_modules/tw-animate-css/dist/tw-animate.css",
    },
  },
};

export default nextConfig;
