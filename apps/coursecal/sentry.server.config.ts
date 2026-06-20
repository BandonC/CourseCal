import * as Sentry from "@sentry/nextjs";

// Server-side Sentry (Node runtime). No-op when the DSN is unset, so local dev
// without Sentry is unaffected. Errors only for v1 — tracing would consume the
// free performance quota. PII is never attached (root CLAUDE.md): no syllabus
// text, emails, names, or tokens in events.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
