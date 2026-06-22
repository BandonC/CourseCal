"use server";

import { z } from "zod";
import { type ActionResult, actionErr, actionOk } from "@/lib/action-result";
import { getOptionalUser } from "@/lib/auth/session";
import { cascadeDeleteEvents } from "@/lib/calendar/cascade-delete";
import type { CourseId, DeliverableId, SemesterId, SeriesId } from "@/lib/db/ids";
import { getDeliverableForEdit } from "@/lib/db/queries/deliverables";
import {
  deleteCourse,
  deleteDeliverable,
  deleteSemester,
  deleteSeries,
  gatherCourseEventIds,
  gatherSemesterEventIds,
  gatherSeriesEventIds,
} from "@/lib/db/queries/deletes";

// Hard delete with a Calendar cascade (§7.3). deleted=false + reconnectNeeded
// means the delete was *blocked* because Calendar was unreachable (no/revoked
// token) — nothing was removed, honoring the "delete always cascades" invariant
// rather than orphaning events (the agreed block-and-reconnect behavior). The DB
// rows are deleted only after the Calendar events are gone (cascadeDeleteEvents).
export type DeleteResult = { deleted: boolean; reconnectNeeded: boolean };

const CALENDAR_FAILED = "Couldn't remove the calendar events. Please try again.";

export async function deleteSemesterAction(
  semesterId: string,
): Promise<ActionResult<DeleteResult>> {
  const user = await getOptionalUser();
  if (!user) return actionErr("You must be signed in.", "unauthenticated");

  const parsed = z.uuid().safeParse(semesterId);
  if (!parsed.success) return actionErr("Invalid semester.", "invalid_input");

  const eventIds = await gatherSemesterEventIds(user.userId, parsed.data as SemesterId);
  if (eventIds === null) return actionErr("Semester not found.", "not_found");

  const cascade = await cascadeDeleteEvents(user.userId, eventIds);
  if (cascade.kind === "reconnect") return actionOk({ deleted: false, reconnectNeeded: true });
  if (cascade.kind === "failed") return actionErr(CALENDAR_FAILED, "calendar_failed");

  await deleteSemester(user.userId, parsed.data as SemesterId);
  return actionOk({ deleted: true, reconnectNeeded: false });
}

export async function deleteCourseAction(
  courseId: string,
): Promise<ActionResult<DeleteResult>> {
  const user = await getOptionalUser();
  if (!user) return actionErr("You must be signed in.", "unauthenticated");

  const parsed = z.uuid().safeParse(courseId);
  if (!parsed.success) return actionErr("Invalid course.", "invalid_input");

  const eventIds = await gatherCourseEventIds(user.userId, parsed.data as CourseId);
  if (eventIds === null) return actionErr("Course not found.", "not_found");

  const cascade = await cascadeDeleteEvents(user.userId, eventIds);
  if (cascade.kind === "reconnect") return actionOk({ deleted: false, reconnectNeeded: true });
  if (cascade.kind === "failed") return actionErr(CALENDAR_FAILED, "calendar_failed");

  await deleteCourse(parsed.data as CourseId);
  return actionOk({ deleted: true, reconnectNeeded: false });
}

export async function deleteSeriesAction(
  courseId: string,
  seriesId: string,
): Promise<ActionResult<DeleteResult>> {
  const user = await getOptionalUser();
  if (!user) return actionErr("You must be signed in.", "unauthenticated");

  const ids = z.object({ courseId: z.uuid(), seriesId: z.uuid() }).safeParse({ courseId, seriesId });
  if (!ids.success) return actionErr("Invalid series.", "invalid_input");

  const eventIds = await gatherSeriesEventIds(
    user.userId,
    ids.data.courseId as CourseId,
    ids.data.seriesId as SeriesId,
  );
  if (eventIds === null) return actionErr("Series not found.", "not_found");

  const cascade = await cascadeDeleteEvents(user.userId, eventIds);
  if (cascade.kind === "reconnect") return actionOk({ deleted: false, reconnectNeeded: true });
  if (cascade.kind === "failed") return actionErr(CALENDAR_FAILED, "calendar_failed");

  await deleteSeries(ids.data.courseId as CourseId, ids.data.seriesId as SeriesId);
  return actionOk({ deleted: true, reconnectNeeded: false });
}

export async function deleteDeliverableAction(
  deliverableId: string,
): Promise<ActionResult<DeleteResult>> {
  const user = await getOptionalUser();
  if (!user) return actionErr("You must be signed in.", "unauthenticated");

  const parsed = z.uuid().safeParse(deliverableId);
  if (!parsed.success) return actionErr("Invalid deliverable.", "invalid_input");
  const id = parsed.data as DeliverableId;

  // Reuse the edit lookup — it proves ownership and returns the stored event id.
  const row = await getDeliverableForEdit(user.userId, id);
  if (!row) return actionErr("Deliverable not found.", "not_found");

  const eventIds = row.googleEventId ? [row.googleEventId] : [];
  const cascade = await cascadeDeleteEvents(user.userId, eventIds);
  if (cascade.kind === "reconnect") return actionOk({ deleted: false, reconnectNeeded: true });
  if (cascade.kind === "failed") return actionErr(CALENDAR_FAILED, "calendar_failed");

  await deleteDeliverable(id);
  return actionOk({ deleted: true, reconnectNeeded: false });
}
