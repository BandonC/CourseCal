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

// Source-map upload is deferred (DECISIONS 2026-06-20): it needs SENTRY_AUTH_TOKEN
// + SENTRY_ORG + SENTRY_PROJECT. Until those are set, builds skip upload — errors
// still report, but prod stack traces stay minified. Add the env vars and the
// org/project/authToken options here to enable readable traces.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
});
