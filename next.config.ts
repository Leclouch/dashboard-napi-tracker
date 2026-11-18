import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Copies only what the server needs into .next/standalone, for the Docker image.
  output: "standalone",
  // The dashboard is on the public internet: refuse to be framed by another site, which would
  // let it trick a logged in person into clicking "Tandai sudah dilihat" or "Nonaktifkan".
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Lets coding agents apply security-only Next.js upgrades.
    agentUpgrade: "security",
  },
  turbopack: {
    // Pin the root to this folder: a stray lockfile higher up (e.g. D:\yarn.lock) would
    // otherwise make Next.js guess the wrong project root.
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
