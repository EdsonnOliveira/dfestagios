import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.GIT_BUILD_DIST_DIR
    ? { distDir: process.env.GIT_BUILD_DIST_DIR }
    : {}),
  reactStrictMode: true,
  trailingSlash: true,
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 500,
        aggregateTimeout: 200,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
      };
    }
    return config;
  },
};

export default nextConfig;
