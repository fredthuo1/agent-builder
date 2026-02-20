import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Prevent rebuild spam when we write generated projects to disk
    config.watchOptions = {
      ...(config.watchOptions ?? {}),
      ignored: ["**/generated/**"],
    };
    return config;
  },
};

export default nextConfig;
