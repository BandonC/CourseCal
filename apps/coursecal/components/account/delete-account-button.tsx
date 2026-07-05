"use client";

import { TypeToConfirmDialog } from "@/components/delete/type-to-confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteAccountAction } from "@/lib/actions/account";

// Type-to-confirm guard for the highest blast-radius action (§7.3 tiering). The
// action deletes everything and signs out via a redirect, so onConfirm doesn't
// resolve — the browser navigates to /login (with a notice, and an orphaned-event
// warning when Calendar couldn't be cleaned up).
export function DeleteAccountButton({ email }: { email: string }) {
  const onConfirm = async () => {
    await deleteAccountAction();
  };

  return (
    <TypeToConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          Delete my account
        </Button>
      }
      title="Delete account"
      description="This permanently deletes your account and all of your semesters, courses, deliverables, and their Google Calendar events. This can't be undone."
      confirmPhrase={email}
      confirmLabel="Delete account"
      onConfirm={onConfirm}
    />
  );
}
