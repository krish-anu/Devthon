import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  async headers() {
    return [
      // Disable COOP on auth pages (login/signup) so popup-based OAuth can access window.closed
      {
        // `source` must start with `/` for Next.js route matcher
        source: "/(login|signup)(/.*)?",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "unsafe-none",
          },
        ],
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
