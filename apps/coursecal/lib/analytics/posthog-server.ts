import "server-only";
import { PostHog } from "posthog-node";
import type { AnalyticsEvent } from "./events";

// Server-authoritative analytics (posthog-node). Used from server actions and RSC
// for outcomes the client can't observe or shouldn't be trusted to report (parse
// results, saves, exports, deletes, conflict counts). No-op when the key is unset,
// mirroring the Sentry pattern (instrumentation.ts) — the app behaves identically
// with analytics off.
//
// Serverless gotcha: posthog-node batches events and flushes on a timer, but a
// Vercel function is frozen/killed the moment the action returns, dropping queued
// events. So we send immediately (flushAt: 1, no interval) and await an explicit
// flush per capture. distinctId is always the user's UUID — never email/name.

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      // Direct to the PostHog cloud — the /ingest reverse proxy is a browser-only
      // concern (ad-blockers); there's no blocker server-side.
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export async function captureServer(
  distinctId: string,
  event: AnalyticsEvent,
): Promise<void> {
  const ph = getClient();
  if (!ph) return;
  ph.capture({ distinctId, event: event.name, properties: event.properties });
  await ph.flush();
}
