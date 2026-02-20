import type { NextConfig } from "next";

const nextConfig: NextConfig = {

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
     ignoreBuildErrors: true,
   },

  webpack: (config) => {
    config.watchOptions = {
      ...(config.watchOptions ?? {}),
      ignored: ["**/generated/**"],
    };
    return config;
  },
};

export default nextConfig;