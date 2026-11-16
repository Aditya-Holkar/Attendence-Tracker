import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep recently visited dynamic pages in the client router cache so
    // back/forward and quick repeat navigation are instant. Server actions and
    // realtime refreshes still bypass it.
    staleTimes: {
      dynamic: 15,
    },
  },
};

export default nextConfig;
