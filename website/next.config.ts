import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'kob.this.is',
        pathname: '/klingogbang/**',
      },
    ],
  },
  // Enable static export if needed
  // output: 'export',
};

export default nextConfig;
