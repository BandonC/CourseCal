import "server-only";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { CourseId, DeliverableId, SemesterId, UserId } from "@/lib/db/ids";
import { courses, deliverables, semesters, users } from "@/lib/db/schema";

// Deliverables across all of a semester's courses that are ready to sync to
// Calendar: dated and not yet synced (no google_event_id), so re-running an export
// resumes where it left off. Each row carries its own course label, so a single
// chunked export can span every course in the semester. The join chain to users
// enforces userId scoping — a user can only sync their own rows.
export async function getSyncableDeliverablesForSemester(
  userId: UserId,
  semesterId: SemesterId,
) {
  return db
    .select({
      id: deliverables.id,
      title: deliverables.title,
      dueDate: deliverables.dueDate,
      dueTime: deliverables.dueTime,
      weightPercent: deliverables.weightPercent,
      notes: deliverables.notes,
      confidence: deliverables.confidence,
      ambiguityReason: deliverables.ambiguityReason,
      courseCode: courses.code,
      courseName: courses.name,
      timezone: users.timezone,
    })
    .from(deliverables)
    .innerJoin(courses, eq(deliverables.courseId, courses.id))
    .innerJoin(semesters, eq(courses.semesterId, semesters.id))
    .innerJoin(users, eq(semesters.userId, users.id))
    .where(
      and(
        eq(semesters.id, semesterId),
        eq(semesters.userId, userId),
        isNotNull(deliverables.dueDate),
        isNull(deliverables.googleEventId),
      ),
    );
}

// Per-course counterpart of getSyncableDeliverablesForSemester — the rows a
// saved-but-unsynced course still needs in Calendar (dated, no google_event_id),
// for the Phase-5 per-course resume (DECISIONS 2026-06-22). Scoped to userId
// through the course → semester → user join.
export async function getSyncableDeliverablesForCourse(userId: UserId, courseId: CourseId) {
  return db
    .select({
      id: deliverables.id,
      title: deliverables.title,
      dueDate: deliverables.dueDate,
      dueTime: deliverables.dueTime,
      weightPercent: deliverables.weightPercent,
      notes: deliverables.notes,
      confidence: deliverables.confidence,
      ambiguityReason: deliverables.ambiguityReason,
      courseCode: courses.code,
      courseName: courses.name,
      timezone: users.timezone,
    })
    .from(deliverables)
    .innerJoin(courses, eq(deliverables.courseId, courses.id))
    .innerJoin(semesters, eq(courses.semesterId, semesters.id))
    .innerJoin(users, eq(semesters.userId, users.id))
    .where(
      and(
        eq(courses.id, courseId),
        eq(semesters.userId, userId),
        isNotNull(deliverables.dueDate),
        isNull(deliverables.googleEventId),
      ),
    );
}

// How many of a course's deliverables are dated but not yet synced — drives the
// "Sync N to Calendar" affordance on the course page. Scoped by userId.
export async function countSyncableForCourse(
  userId: UserId,
  courseId: CourseId,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(deliverables)
    .innerJoin(courses, eq(deliverables.courseId, courses.id))
    .innerJoin(semesters, eq(courses.semesterId, semesters.id))
    .where(
      and(
        eq(courses.id, courseId),
        eq(semesters.userId, userId),
        isNotNull(deliverables.dueDate),
        isNull(deliverables.googleEventId),
      ),
    );
  return row?.n ?? 0;
}

export async function setGoogleEventId(id: DeliverableId, eventId: string): Promise<void> {
  await db
    .update(deliverables)
    .set({ googleEventId: eventId, updatedAt: new Date() })
    .where(eq(deliverables.id, id));
}

export async function clearGoogleEventId(id: DeliverableId): Promise<void> {
  await db
    .update(deliverables)
    .set({ googleEventId: null, updatedAt: new Date() })
    .where(eq(deliverables.id, id));
}

// One deliverable resolved for an inline edit, scoped to userId through the
// course → semester → user join (a row owned by someone else is indistinguishable
// from a missing one). Carries what the edit action needs to reconcile Calendar:
// the stored event id, the course label, the user's timezone, and the model's
// confidence/ambiguity (shown read-only — re-emitted into the patched event).
export async function getDeliverableForEdit(userId: UserId, id: DeliverableId) {
  const [row] = await db
    .select({
      id: deliverables.id,
      googleEventId: deliverables.googleEventId,
      confidence: deliverables.confidence,
      ambiguityReason: deliverables.ambiguityReason,
      courseCode: courses.code,
      courseName: courses.name,
      timezone: users.timezone,
    })
    .from(deliverables)
    .innerJoin(courses, eq(deliverables.courseId, courses.id))
    .innerJoin(semesters, eq(courses.semesterId, semesters.id))
    .innerJoin(users, eq(semesters.userId, users.id))
    .where(and(eq(deliverables.id, id), eq(semesters.userId, userId)));
  return row ?? null;
}

type DeliverableEditableFields = Pick<
  typeof deliverables.$inferInsert,
  | "title"
  | "type"
  | "dueDate"
  | "dueTime"
  | "weightPercent"
  | "notes"
  | "confidence"
  | "ambiguityReason"
>;

// Persists the edited fields (ownership already verified by getDeliverableForEdit,
// so this updates by id alone — mirrors setGoogleEventId). The caller sets
// confidence to high + clears ambiguity_reason: a human-edited row is verified, so
// it stops counting as "to check". Calendar reconciliation is the caller's job.
export async function updateDeliverableFields(
  id: DeliverableId,
  fields: DeliverableEditableFields,
): Promise<void> {
  await db
    .update(deliverables)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(deliverables.id, id));
}
