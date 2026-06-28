"use client";

import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/lib/analytics/use-analytics";

// CTA for the landing. The form's action is a server action (Google signIn); this
// client child captures the intent on click, then the default submit proceeds.
export function GetStartedButton() {
  const { capture } = useAnalytics();
  return (
    <Button
      type="submit"
      size="lg"
      onClick={() => capture({ name: "get_started_clicked" })}
    >
      Get started with Google
    </Button>
  );
}
