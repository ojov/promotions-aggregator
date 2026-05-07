import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@promos/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

export default nextConfig;
