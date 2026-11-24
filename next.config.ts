import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  serverExternalPackages: ["pdf-lib", "@pdf-lib/fontkit", "mammoth", "unpdf"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/@fontsource/dm-sans/files/dm-sans-latin-*.woff", "./node_modules/@fontsource/spectral/files/spectral-latin-*.woff"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default config;
