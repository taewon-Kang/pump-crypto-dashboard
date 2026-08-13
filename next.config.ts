import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Native addon (.node binding) — must stay unbundled or Turbopack chokes
  // trying to place it in an ESM chunk.
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
