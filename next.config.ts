import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
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
