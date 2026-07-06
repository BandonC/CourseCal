"use server";

import { redirect } from "next/navigation";
import { type ActionResult, actionErr, actionOk } from "@/lib/action-result";
import { captureServer } from "@/lib/analytics/posthog-server";
import { signOut } from "@/lib/auth";
import { getOptionalUser } from "@/lib/auth/session";
import { cascadeDeleteEvents } from "@/lib/calendar/cascade-delete";
import { revokeGoogleGrant } from "@/lib/calendar/client";
import { gatherAllEventIdsForUser } from "@/lib/db/queries/deletes";
import { deleteUser, getDecryptedRefreshToken, getUserExport } from "@/lib/db/queries/users";

// Account-level data portability + erasure (§14 — do before real users). Both
// actions resolve the session first and act only on the caller's own rows.

// The export payload is PII (email, name, syllabus text). It is streamed straight
// back to the requester and never logged, sent to Sentry, or added to an analytics
// property — the account_exported event is bare.
export async function exportAccountAction(): Promise<
  ActionResult<{ json: string; filename: string }>
> {
  const user = await getOptionalUser();
  if (!user) return actionErr("You must be signed in.", "unauthenticated");

  const data = await getUserExport(user.userId);
  if (!data) return actionErr("Account not found.", "not_found");

  const json = JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 2);
  await captureServer(user.userId, { name: "account_exported" });

  const stamp = new Date().toISOString().slice(0, 10);
  return actionOk({ json, filename: `coursecal-export-${stamp}.json` });
}

// Hard-delete the account and sign out. Proceed-and-warn (agreed): unlike the
// per-item deletes, account deletion is NEVER blocked on Calendar — erasure must
// always complete. If the events can't be removed (revoked/dead token), we delete
// the DB rows + token anyway and tell the user those events may linger in Google
// Calendar. Ends in a redirect via signOut, so there is no success value to
// return; the null-session guard mirrors requireUser and just routes to /login.
export async function deleteAccountAction(): Promise<void> {
  const user = await getOptionalUser();
  if (!user) redirect("/login");

  const eventIds = await gatherAllEventIdsForUser(user.userId);
  const cascade = await cascadeDeleteEvents(user.userId, eventIds);
  // ok → all events removed; reconnect/failed → some may remain (proceed anyway).
  const orphaned = cascade.kind === "ok" ? 0 : eventIds.length;

  // Fully disconnect: revoke our own Google grant while the token is still live
  // (after event cleanup, before the row is dropped). Read fresh — the cascade
  // clears a dead token on the reconnect path, so this is null there and there's
  // nothing to revoke (the user already did). Also forces fresh consent on any
  // later re-signup, so Calendar works again without the reconnect flow.
  const refreshToken = await getDecryptedRefreshToken(user.userId);
  if (refreshToken) await revokeGoogleGrant(refreshToken);

  await deleteUser(user.userId);
  await captureServer(user.userId, {
    name: "account_deleted",
    properties: { orphaned_event_count: orphaned },
  });

  const redirectTo = orphaned > 0 ? `/login?deleted=1&orphaned=${orphaned}` : "/login?deleted=1";
  await signOut({ redirectTo });
}
