import * as Sentry from "@sentry/nextjs";

// Client-side Sentry (browser). No-op when the DSN is unset. Errors only, no PII.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});

// Lets Sentry tie errors to App Router client navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
