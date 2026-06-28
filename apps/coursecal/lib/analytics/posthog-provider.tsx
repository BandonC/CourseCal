"use client";

import { PostHogProvider as PHProvider } from "posthog-js/react";
import type { ReactNode } from "react";

// Client analytics provider. No-op when the key is unset (mirrors Sentry) — with no
// key we render children without the provider, and usePostHog() falls back to the
// uninitialized default instance whose capture/identify calls are silent.
//
// Ingestion is reverse-proxied through the same-origin /ingest path (a Next rewrite
// in next.config.ts) so ad-blockers don't drop events; ui_host points at the real
// PostHog app so toolbar/links resolve. autocapture is OFF by design — it scrapes
// nearby DOM text (course/deliverable/syllabus content = PII); only the explicit
// taxonomy in events.ts is ever sent. Pageviews are captured on App Router history
// changes; person profiles only for identified users (cheaper, anon pageviews still
// counted).

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export function PostHogProvider({ children }: { children: ReactNode }) {
  if (!KEY) return <>{children}</>;

  return (
    <PHProvider
      apiKey={KEY}
      options={{
        api_host: "/ingest",
        ui_host: HOST.replace(".i.posthog.com", ".posthog.com"),
        autocapture: false,
        capture_pageview: "history_change",
        capture_pageleave: true,
        person_profiles: "identified_only",
      }}
    >
      {children}
    </PHProvider>
  );
}
