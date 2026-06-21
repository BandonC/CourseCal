import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Consume the syllabus-parser library from TypeScript source — no build step,
  // no dist/. See COURSECAL.md §5.2.
  transpilePackages: ["@coursecal/syllabus-parser"],

  // Static security headers. A Content-Security-Policy is intentionally deferred
  // to pre-launch — a correct Next CSP needs per-request nonces (see root
  // CLAUDE.md security rules).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

// Source maps upload only when SENTRY_AUTH_TOKEN is present in the build env
// (set in Vercel Production) — the bundler plugin skips upload without it, so
// local builds and token-less environments succeed and just leave prod traces
// minified. org/project are not secret, so they live here directly.
export default withSentryConfig(nextConfig, {
  org: "brandon-9f",
  project: "coursecal",
  silent: !process.env.CI,
});
