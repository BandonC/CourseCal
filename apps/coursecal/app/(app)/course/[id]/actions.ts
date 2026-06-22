"use server";

import { z } from "zod";
import { ParseResultSchema } from "@coursecal/syllabus-parser";
import { type ActionResult, actionErr, actionOk } from "@/lib/action-result";
import { getOptionalUser } from "@/lib/auth/session";
import { cascadeDeleteEvents } from "@/lib/calendar/cascade-delete";
import { calendarOAuthClient, type CalendarOAuthClient } from "@/lib/calendar/client";
import { buildCalendarEvent } from "@/lib/calendar/event";
import { syncDeliverablesToCalendar, type SyncSummary } from "@/lib/calendar/export-sync";
import { deleteEvent, insertEvent, patchEvent } from "@/lib/calendar/sync";
import type { CourseId, DeliverableId } from "@/lib/db/ids";
import {
  getCourseNameCode,
  getSyncedDeliverablesForCourse,
  replaceCourseDeliverables,
  updateCourseFields,
} from "@/lib/db/queries/courses";
import { gatherCourseEventIds } from "@/lib/db/queries/deletes";
import {
  clearGoogleEventId,
  getDeliverableForEdit,
  getSyncableDeliverablesForCourse,
  setGoogleEventId,
  updateDeliverableFields,
} from "@/lib/db/queries/deliverables";
import { clearRefreshToken, getDecryptedRefreshToken } from "@/lib/db/queries/users";
import { CourseEditSchema, DeliverableEditSchema } from "./schema";

// What happened to the Calendar event, for an accurate toast. "skipped" means the
// DB saved but Calendar was unreachable (no token / revoked) — nothing is
// orphaned; a later sync reconciles. "failed" is a non-terminal Calendar error.
export type EditCalendarOutcome =
  | "patched"
  | "created"
  | "recreated"
  | "deleted"
  | "none"
  | "failed"
  | "skipped";

type EditResult = { calendar: EditCalendarOutcome; reconnectNeeded: boolean };

// Inline deliverable edit (§3.2 / §6.4): update the DB row (source of truth),
// then reconcile its single Calendar event by the date transition —
//   has date + has event   → patch (404 → recreate, the event was deleted in Google)
//   has date + no event    → create (the item just gained a date)
//   no date  + has event    → delete (the item lost its date)
//   no date  + no event     → nothing
// Ownership is resolved through the join chain to userId before any write; a
// revoked token clears the stored token and reports reconnect (the DB edit
// stands, so nothing is lost and a later sync fixes Calendar).
export async function updateDeliverableAction(
  input: unknown,
): Promise<ActionResult<EditResult>> {
  const user = await getOptionalUser();
  if (!user) return actionErr("You must be signed in to edit.", "unauthenticated");

  const parsed = DeliverableEditSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr("The deliverable details are invalid.", "invalid_input");
  }
  const { deliverableId, title, type, dueDate, dueTime, weightPercent, notes } = parsed.data;
  const id = deliverableId as DeliverableId;

  const row = await getDeliverableForEdit(user.userId, id);
  if (!row) return actionErr("Deliverable not found.", "not_found");

  const weight = weightPercent === null ? null : weightPercent.toFixed(2);
  // A human edit verifies the row → mark it high-confidence and drop the flag, so
  // it stops counting as "to check" and the event loses its "Flagged" line.
  await updateDeliverableFields(id, {
    title,
    type,
    dueDate,
    dueTime,
    weightPercent: weight,
    notes,
    confidence: "high",
    ambiguityReason: null,
  });

  const existingEventId = row.googleEventId;

  // Resolve a Calendar client only when there's work to do; null = no usable token.
  const authOrNull = async (): Promise<CalendarOAuthClient | null> => {
    const refreshToken = await getDecryptedRefreshToken(user.userId);
    return refreshToken ? calendarOAuthClient(refreshToken) : null;
  };
  const onReconnect = async (): Promise<EditResult> => {
    await clearRefreshToken(user.userId);
    return { calendar: "skipped", reconnectNeeded: true };
  };

  // Lost its date → delete the event (or nothing to delete).
  if (dueDate === null) {
    if (existingEventId === null) return actionOk({ calendar: "none", reconnectNeeded: false });
    const auth = await authOrNull();
    if (!auth) return actionOk({ calendar: "skipped", reconnectNeeded: true });
    const out = await deleteEvent(auth, existingEventId);
    if (out.kind === "ok") {
      await clearGoogleEventId(id);
      return actionOk({ calendar: "deleted", reconnectNeeded: false });
    }
    if (out.kind === "reconnect") return actionOk(await onReconnect());
    return actionOk({ calendar: "failed", reconnectNeeded: false });
  }

  // Has a date → build the event from the freshly saved values.
  const auth = await authOrNull();
  if (!auth) return actionOk({ calendar: "skipped", reconnectNeeded: true });
  const event = buildCalendarEvent({
    courseLabel: row.courseCode ?? row.courseName,
    title,
    dueDate,
    dueTime,
    weightPercent: weight,
    notes,
    // Matches the cleared flag persisted above — no "Flagged" line on the event.
    confidence: "high",
    ambiguityReason: null,
    timezone: row.timezone,
  });

  // Gained a date → create.
  if (existingEventId === null) {
    const out = await insertEvent(auth, event);
    if (out.kind === "ok") {
      await setGoogleEventId(id, out.eventId);
      return actionOk({ calendar: "created", reconnectNeeded: false });
    }
    if (out.kind === "reconnect") return actionOk(await onReconnect());
    return actionOk({ calendar: "failed", reconnectNeeded: false });
  }

  // Existing event → patch; a 404 means it was deleted in Google → recreate (§6.4).
  const out = await patchEvent(auth, existingEventId, event);
  if (out.kind === "ok") return actionOk({ calendar: "patched", reconnectNeeded: false });
  if (out.kind === "reconnect") return actionOk(await onReconnect());
  if (out.kind === "notFound") {
    const ins = await insertEvent(auth, event);
    if (ins.kind === "ok") {
      await setGoogleEventId(id, ins.eventId);
      return actionOk({ calendar: "recreated", reconnectNeeded: false });
    }
    if (ins.kind === "reconnect") return actionOk(await onReconnect());
    return actionOk({ calendar: "failed", reconnectNeeded: false });
  }
  return actionOk({ calendar: "failed", reconnectNeeded: false });
}

// What happened to the course's event titles after an edit (same vocabulary as
// the deliverable edit). "none" = the label didn't change (or nothing synced).
export type CourseLabelOutcome = "patched" | "none" | "failed" | "skipped";

const LABEL_PATCH_CONCURRENCY = 6;

// Course header edit (§3.2). Updates name/code/instructor, then — only if the
// label (code, else name) changed — re-patches the "<label> · <title>" summary on
// every synced event of the course (the agreed re-patch-on-label-change behavior).
// Instructor-only edits touch no events. The DB write is the source of truth, so a
// Calendar problem reports "skipped"/"failed" without rolling back; nothing is
// orphaned. A 404 on a title patch (event deleted in Google) is skipped — there's
// no full event to recreate here.
export async function updateCourseAction(
  input: unknown,
): Promise<ActionResult<{ calendar: CourseLabelOutcome; reconnectNeeded: boolean }>> {
  const user = await getOptionalUser();
  if (!user) return actionErr("You must be signed in to edit.", "unauthenticated");

  const parsed = CourseEditSchema.safeParse(input);
  if (!parsed.success) return actionErr("The course details are invalid.", "invalid_input");
  const { courseId, name, code, instructor } = parsed.data;
  const cid = courseId as CourseId;

  const old = await getCourseNameCode(user.userId, cid);
  if (!old) return actionErr("Course not found.", "not_found");

  await updateCourseFields(cid, { name, code, instructor });

  const oldLabel = old.code ?? old.name;
  const newLabel = code ?? name;
  if (oldLabel === newLabel) return actionOk({ calendar: "none", reconnectNeeded: false });

  const synced = await getSyncedDeliverablesForCourse(user.userId, cid);
  if (synced.length === 0) return actionOk({ calendar: "none", reconnectNeeded: false });

  const refreshToken = await getDecryptedRefreshToken(user.userId);
  if (!refreshToken) return actionOk({ calendar: "skipped", reconnectNeeded: true });
  const auth = calendarOAuthClient(refreshToken);

  let failed = 0;
  let reconnect = false;
  for (let i = 0; i < synced.length && !reconnect; i += LABEL_PATCH_CONCURRENCY) {
    const chunk = synced.slice(i, i + LABEL_PATCH_CONCURRENCY);
    const outcomes = await Promise.all(
      chunk.map((d) =>
        patchEvent(auth, d.googleEventId, { summary: `${newLabel} · ${d.title}` }),
      ),
    );
    for (const o of outcomes) {
      if (o.kind === "reconnect") reconnect = true;
      else if (o.kind === "failed") failed++;
      // ok / notFound (event deleted in Google) → nothing to do
    }
  }

  if (reconnect) {
    await clearRefreshToken(user.userId);
    return actionOk({ calendar: "skipped", reconnectNeeded: true });
  }
  if (failed > 0) return actionOk({ calendar: "failed", reconnectNeeded: false });
  return actionOk({ calendar: "patched", reconnectNeeded: false });
}

// Per-course resume of the Calendar export — syncs this course's dated,
// not-yet-synced deliverables (the saved-but-unsynced path; DECISIONS 2026-06-22).
// Reuses the shared chunked exporter, so it's resumable and handles reconnect the
// same way the semester export does.
export async function exportCourseToCalendarAction(
  courseId: string,
): Promise<ActionResult<SyncSummary>> {
  const user = await getOptionalUser();
  if (!user) return actionErr("You must be signed in to sync.", "unauthenticated");

  const parsed = z.uuid().safeParse(courseId);
  if (!parsed.success) return actionErr("Invalid course.", "invalid_input");

  const rows = (
    await getSyncableDeliverablesForCourse(user.userId, parsed.data as CourseId)
  ).filter((d): d is typeof d & { dueDate: string } => d.dueDate !== null);

  return actionOk(await syncDeliverablesToCalendar(user.userId, rows));
}

// Commits a re-parse replacement (§7.1): the client sends the reviewed fresh
// ParseResult; the server re-validates it, deletes the course's existing Calendar
// events first (block-and-reconnect, same invariant as deletes), then swaps the
// deliverable rows. reconnectNeeded=true means the swap was blocked because
// Calendar was unreachable — nothing changed. The new rows are unsynced, so the
// course page's "Sync to Calendar" affordance handles re-export.
export async function replaceCourseDeliverablesAction(
  courseId: string,
  parseResult: unknown,
): Promise<ActionResult<{ reconnectNeeded: boolean }>> {
  const user = await getOptionalUser();
  if (!user) return actionErr("You must be signed in to re-parse.", "unauthenticated");

  const idParsed = z.uuid().safeParse(courseId);
  if (!idParsed.success) return actionErr("Invalid course.", "invalid_input");

  const resultParsed = ParseResultSchema.safeParse(parseResult);
  if (!resultParsed.success) {
    return actionErr("The reviewed deliverables are invalid.", "invalid_input");
  }
  const cid = idParsed.data as CourseId;

  const eventIds = await gatherCourseEventIds(user.userId, cid);
  if (eventIds === null) return actionErr("Course not found.", "not_found");

  const cascade = await cascadeDeleteEvents(user.userId, eventIds);
  if (cascade.kind === "reconnect") return actionOk({ reconnectNeeded: true });
  if (cascade.kind === "failed") {
    return actionErr("Couldn't update the calendar events. Please try again.", "calendar_failed");
  }

  try {
    await replaceCourseDeliverables(cid, resultParsed.data.deliverables);
  } catch {
    return actionErr("Couldn't replace the deliverables. Please try again.", "save_failed");
  }
  return actionOk({ reconnectNeeded: false });
}
