import type { NextConfig } from "next";

// Header keamanan. CSP Report-Only dulu (ada skrip tema inline); ganti ke Content-Security-Policy setelah konsol bersih.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" }, // 'self' agar iframe PDF dokumen tetap jalan
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy-Report-Only", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Server actions default to 1 MB. Docs allow 20 MB; bug form allows 5 screenshots x 5 MB.
  experimental: { serverActions: { bodySizeLimit: "26mb" } },
};

export default nextConfig;
