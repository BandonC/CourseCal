"use client";

import { usePostHog } from "posthog-js/react";
import type { AnalyticsEvent } from "./events";

// Typed client-side capture. The event must be one of the AnalyticsEvent union, so
// names and property shapes are compiler-enforced at every call site. usePostHog()
// returns the uninitialized default instance when no provider is mounted (key
// unset), so capture is a silent no-op then — same no-op-without-key contract as the
// rest of the analytics layer.
export function useAnalytics() {
  const posthog = usePostHog();
  return {
    capture(event: AnalyticsEvent) {
      posthog.capture(event.name, event.properties);
    },
  };
}
