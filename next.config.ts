import type { NextConfig } from "next";

/**
 * This tool is served inside the shop at /tools/accessibility-statement: the shop
 * rewrites that path to this deployment, so the app is built with the same basePath.
 * Set NEXT_PUBLIC_BASE_PATH="" for a standalone root deploy.
 */
const defaultBase =
  process.env.NODE_ENV === "production" ? "/tools/accessibility-statement" : "";
const rawBase = process.env.NEXT_PUBLIC_BASE_PATH ?? defaultBase;
const basePath = rawBase.trim().replace(/\/$/, "");

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
