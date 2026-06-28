import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// PostHog ingestion is reverse-proxied through the same-origin /ingest path so
// ad-blockers (which block known analytics domains) don't silently drop events.
// The host is the region's cloud ingestion endpoint (default US); static assets
// live on the region's -assets subdomain. See COURSECAL.md §9.5.
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const POSTHOG_ASSETS_HOST = POSTHOG_HOST.replace(".i.posthog.com", "-assets.i.posthog.com");

const nextConfig: NextConfig = {
  // Consume the syllabus-parser library from TypeScript source — no build step,
  // no dist/. See COURSECAL.md §5.2.
  transpilePackages: ["@coursecal/syllabus-parser"],

  // PostHog needs trailing slashes left intact on proxied ingest requests.
  skipTrailingSlashRedirect: true,

  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: `${POSTHOG_ASSETS_HOST}/static/:path*`,
      },
      { source: "/ingest/:path*", destination: `${POSTHOG_HOST}/:path*` },
    ];
  },

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
// minified. org/project are not secret, so they live here directly. Uploaded
// source maps are deleted from the build afterward (plugin default), so they're
// never served to the client.
export default withSentryConfig(nextConfig, {
  org: "brandon-9f",
  project: "coursecal",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
