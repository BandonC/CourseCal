"use client";

import { GoogleIcon } from "@/components/icons/google";
import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/lib/analytics/use-analytics";

// Google sign-in button for the signed-out screen. The form's action is a server action (Google signIn); this
// client child captures the intent on click, then the default submit proceeds.
export function GetStartedButton() {
  const { capture } = useAnalytics();
  return (
    <Button
      type="submit"
      size="lg"
      className="h-11 w-full gap-2"
      onClick={() => capture({ name: "get_started_clicked" })}
    >
      <GoogleIcon className="size-4" />
      Continue with Google
    </Button>
  );
}
