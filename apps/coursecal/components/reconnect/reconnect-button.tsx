"use client";

import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/lib/analytics/use-analytics";

// Submit button for the reconnect form. The form's action is a server action
// (signIn with prompt=consent); this client child captures the intent on click,
// then the default submit proceeds.
export function ReconnectButton() {
  const { capture } = useAnalytics();
  return (
    <Button
      type="submit"
      size="lg"
      onClick={() => capture({ name: "reconnect_initiated" })}
    >
      Reconnect Google
    </Button>
  );
}
