"use client";

import { GoogleIcon } from "@/components/icons/google";
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
      className="h-11 gap-2 px-5"
      onClick={() => capture({ name: "get_started_clicked" })}
    >
      <GoogleIcon className="size-4" />
      Get started with Google
    </Button>
  );
}
