import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server actions default to 1 MB. Docs allow 20 MB; bug form allows 5 screenshots x 5 MB.
  experimental: { serverActions: { bodySizeLimit: "26mb" } },
  // @react-pdf/renderer (report PDF export) breaks when bundled by webpack; load it from node_modules at runtime.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
