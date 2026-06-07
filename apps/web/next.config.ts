import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  transpilePackages: ["@neon/site-locales"],
};

export default nextConfig;
