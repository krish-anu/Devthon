import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Load parent/root .env into process.env so the client can use the monorepo root `.env`
const rootEnv = path.resolve(__dirname, "../.env");
if (fs.existsSync(rootEnv)) {
  const content = fs.readFileSync(rootEnv, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)?\s*$/);
    if (!m) return;
    const key = m[1];
    let val = m[2] ?? "";
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  });
}

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
