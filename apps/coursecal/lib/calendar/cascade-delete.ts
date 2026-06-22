import "server-only";

import { calendarOAuthClient } from "@/lib/calendar/client";
import { deleteEvent } from "@/lib/calendar/sync";
import type { UserId } from "@/lib/db/ids";
import { clearRefreshToken, getDecryptedRefreshToken } from "@/lib/db/queries/users";

// Removes a set of Calendar events before their DB rows are deleted or replaced
// (§7.3 cascade; also used by re-parse replacement). No events → ok immediately
// (a scope with nothing synced needs no token). Any non-ok event delete aborts so
// we never drop/replace rows while an event lingers (block-and-reconnect). A
// surfaced reconnect clears the token. Retry-safe: already-deleted events return
// 404 → ok (deleteEvent treats it so). Shared as a plain server-only helper (not a
// "use server" export) so callers in either layer can reuse it.
const DELETE_CONCURRENCY = 6;

export type CascadeOutcome = { kind: "ok" } | { kind: "reconnect" } | { kind: "failed" };

export async function cascadeDeleteEvents(
  userId: UserId,
  eventIds: string[],
): Promise<CascadeOutcome> {
  if (eventIds.length === 0) return { kind: "ok" };

  const refreshToken = await getDecryptedRefreshToken(userId);
  if (!refreshToken) return { kind: "reconnect" };

  const auth = calendarOAuthClient(refreshToken);
  let reconnect = false;
  let failed = false;

  for (let i = 0; i < eventIds.length && !reconnect; i += DELETE_CONCURRENCY) {
    const chunk = eventIds.slice(i, i + DELETE_CONCURRENCY);
    const outcomes = await Promise.all(chunk.map((eid) => deleteEvent(auth, eid)));
    for (const o of outcomes) {
      if (o.kind === "reconnect") reconnect = true;
      else if (o.kind === "failed") failed = true;
    }
  }

  if (reconnect) {
    await clearRefreshToken(userId);
    return { kind: "reconnect" };
  }
  if (failed) return { kind: "failed" };
  return { kind: "ok" };
}
