// Runs once when a server instance boots. Importing the env module here forces
// the Zod validation to run at startup so misconfiguration fails fast, before
// any request is served (COURSECAL.md §9.5). Guarded to the Node runtime — the
// env module is server-only and not edge-compatible. Sentry is initialized per
// runtime here too (no-op without a DSN).

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/env");
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// App Router server-error hook — forwards uncaught server errors to Sentry.
export const onRequestError = Sentry.captureRequestError;
