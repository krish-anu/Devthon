import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  async headers() {
    return [
      // Exclude auth pages (login/signup) from COOP so popup-based OAuth can access window.closed
      {
        source: "^/(login|signup)(/.*)?$",
        headers: [],
      },
      // Apply COOP to the rest of the site for cross-origin isolation protections
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
