"use client";

import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

// Ties analytics to the signed-in user by their UUID only — never email or name (no
// PII). Mounted in the authed (app) layout, so it identifies once per session and
// resets on unmount, i.e. when the user leaves the authed area (sign-out → /login),
// so post-logout events don't stick to the previous user. The (app) layout persists
// across intra-app navigation, so this doesn't churn on every page change. Identify
// is a sync with an external system — the sanctioned useEffect case.
export function AnalyticsIdentify({ userId }: { userId: string }) {
  const posthog = usePostHog();

  useEffect(() => {
    posthog.identify(userId);
    return () => {
      posthog.reset();
    };
  }, [posthog, userId]);

  return null;
}
