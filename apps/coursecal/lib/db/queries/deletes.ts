import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import type { CourseId, DeliverableId, SemesterId, SeriesId, UserId } from "@/lib/db/ids";
import { courses, deliverables, semesters } from "@/lib/db/schema";

// Delete-cascade helpers (§7.3). Each gather* proves ownership through the join
// chain to userId (returns null when the target isn't the user's → the action
// 404s) and collects the google_event_ids that must be removed from Calendar
// *before* the DB rows go (the FK cascade deletes the rows, discarding the ids —
// so the events have to be deleted first). Only non-null ids are gathered;
// dateless/unsynced rows contribute none. The delete* helpers run after the
// Calendar cascade and after ownership is established, so they delete by id (the
// semester delete keeps the userId predicate as belt-and-suspenders).

export async function gatherSemesterEventIds(
  userId: UserId,
  semesterId: SemesterId,
): Promise<string[] | null> {
  const [owner] = await db
    .select({ id: semesters.id })
    .from(semesters)
    .where(and(eq(semesters.id, semesterId), eq(semesters.userId, userId)));
  if (!owner) return null;

  const rows = await db
    .select({ eventId: deliverables.googleEventId })
    .from(deliverables)
    .innerJoin(courses, eq(deliverables.courseId, courses.id))
    .where(and(eq(courses.semesterId, semesterId), isNotNull(deliverables.googleEventId)));
  return rows.map((r) => r.eventId as string);
}

export async function deleteSemester(userId: UserId, semesterId: SemesterId): Promise<void> {
  await db
    .delete(semesters)
    .where(and(eq(semesters.id, semesterId), eq(semesters.userId, userId)));
}

export async function gatherCourseEventIds(
  userId: UserId,
  courseId: CourseId,
): Promise<string[] | null> {
  const owner = await ownsCourse(userId, courseId);
  if (!owner) return null;

  const rows = await db
    .select({ eventId: deliverables.googleEventId })
    .from(deliverables)
    .where(and(eq(deliverables.courseId, courseId), isNotNull(deliverables.googleEventId)));
  return rows.map((r) => r.eventId as string);
}

export async function deleteCourse(courseId: CourseId): Promise<void> {
  await db.delete(courses).where(eq(courses.id, courseId));
}

export async function gatherSeriesEventIds(
  userId: UserId,
  courseId: CourseId,
  seriesId: SeriesId,
): Promise<string[] | null> {
  const owner = await ownsCourse(userId, courseId);
  if (!owner) return null;

  const rows = await db
    .select({ eventId: deliverables.googleEventId })
    .from(deliverables)
    .where(
      and(
        eq(deliverables.courseId, courseId),
        eq(deliverables.seriesId, seriesId),
        isNotNull(deliverables.googleEventId),
      ),
    );
  return rows.map((r) => r.eventId as string);
}

export async function deleteSeries(courseId: CourseId, seriesId: SeriesId): Promise<void> {
  await db
    .delete(deliverables)
    .where(and(eq(deliverables.courseId, courseId), eq(deliverables.seriesId, seriesId)));
}

export async function deleteDeliverable(id: DeliverableId): Promise<void> {
  await db.delete(deliverables).where(eq(deliverables.id, id));
}

// A course is owned when its parent semester belongs to the user. Courses carry
// no userId of their own, so ownership always resolves through the semester.
async function ownsCourse(userId: UserId, courseId: CourseId): Promise<boolean> {
  const [row] = await db
    .select({ id: courses.id })
    .from(courses)
    .innerJoin(semesters, eq(courses.semesterId, semesters.id))
    .where(and(eq(courses.id, courseId), eq(semesters.userId, userId)));
  return Boolean(row);
}
