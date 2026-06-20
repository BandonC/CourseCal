"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Captures React render errors that bubble to the root (the one place a plain
// error boundary can't reach). useEffect here is the sanctioned use — syncing
// with an external system (Sentry). No-op when Sentry has no DSN.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <p>Something went wrong. Please refresh and try again.</p>
      </body>
    </html>
  );
}
