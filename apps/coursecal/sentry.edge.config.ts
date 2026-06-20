import * as Sentry from "@sentry/nextjs";

// Edge runtime Sentry (middleware / edge routes). Same error-only, no-PII,
// no-op-without-DSN policy as the server config.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
