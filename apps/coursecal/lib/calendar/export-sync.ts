import "server-only";

import type { Confidence } from "@coursecal/syllabus-parser";
import { calendarOAuthClient } from "@/lib/calendar/client";
import { buildCalendarEvent } from "@/lib/calendar/event";
import { insertEvent } from "@/lib/calendar/sync";
import type { DeliverableId, UserId } from "@/lib/db/ids";
import { setGoogleEventId } from "@/lib/db/queries/deliverables";
import { clearRefreshToken, getDecryptedRefreshToken } from "@/lib/db/queries/users";

// Shared Calendar export used by both the semester-wide and per-course export
// actions (§6.3). Rows are dated, not-yet-synced deliverables carrying their own
// course label + the user's timezone, so one chunked pass spans any scope.
// Resumable: google_event_id is written back per success, so re-running skips
// already-synced rows. Revoked consent clears the stored token and reports
// reconnect. Insert several at a time (apps/coursecal/CLAUDE.md — serial is too
// slow; no batch endpoint).
const SYNC_CONCURRENCY = 6;

export type SyncableDeliverable = {
  id: DeliverableId;
  title: string;
  dueDate: string; // caller filters out null due dates
  dueTime: string | null;
  weightPercent: string | null;
  notes: string | null;
  confidence: Confidence;
  ambiguityReason: string | null;
  courseCode: string | null;
  courseName: string;
  timezone: string;
};

export type SyncSummary = { created: number; failed: number; reconnectNeeded: boolean };

export async function syncDeliverablesToCalendar(
  userId: UserId,
  rows: SyncableDeliverable[],
): Promise<SyncSummary> {
  if (rows.length === 0) return { created: 0, failed: 0, reconnectNeeded: false };

  const refreshToken = await getDecryptedRefreshToken(userId);
  if (!refreshToken) return { created: 0, failed: 0, reconnectNeeded: true };

  const auth = calendarOAuthClient(refreshToken);
  let created = 0;
  let failed = 0;
  let reconnectNeeded = false;

  for (let i = 0; i < rows.length && !reconnectNeeded; i += SYNC_CONCURRENCY) {
    const chunk = rows.slice(i, i + SYNC_CONCURRENCY);
    const outcomes = await Promise.all(
      chunk.map(async (d) => {
        const event = buildCalendarEvent({
          courseLabel: d.courseCode ?? d.courseName,
          title: d.title,
          dueDate: d.dueDate,
          dueTime: d.dueTime,
          weightPercent: d.weightPercent,
          notes: d.notes,
          confidence: d.confidence,
          ambiguityReason: d.ambiguityReason,
          timezone: d.timezone,
        });
        const outcome = await insertEvent(auth, event);
        if (outcome.kind === "ok") {
          await setGoogleEventId(d.id, outcome.eventId);
        }
        return outcome;
      }),
    );
    for (const o of outcomes) {
      if (o.kind === "ok") created++;
      else if (o.kind === "reconnect") reconnectNeeded = true;
      else failed++;
    }
  }

  if (reconnectNeeded) {
    await clearRefreshToken(userId);
  }

  return { created, failed, reconnectNeeded };
}
