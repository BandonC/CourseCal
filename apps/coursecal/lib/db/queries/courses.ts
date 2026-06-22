import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { ParseResult } from "@coursecal/syllabus-parser";
import { db } from "@/lib/db";
import type { CourseId, DeliverableId, UserId } from "@/lib/db/ids";
import { courses, deliverables, semesters, users } from "@/lib/db/schema";
import { toDeliverableRows } from "@/lib/recurrence/to-deliverable-rows";

// One course with its deliverables, for the course detail/edit page (§3.2).
// Ownership is scoped in SQL: the course row is selected only when its parent
// semester belongs to userId, so a course owned by someone else is
// indistinguishable from a missing one (the page 404s). Once ownership is
// established, the deliverables are fetched by courseId — that course is proven
// to be the user's, so no further join is needed. Deliverables are ordered by
// due date (Postgres sorts NULLs last on asc, so dateless items trail) then
// creation for a stable sequence within a date.
export async function getCourseDetail(userId: UserId, courseId: CourseId) {
  const [course] = await db
    .select({
      id: courses.id,
      semesterId: courses.semesterId,
      name: courses.name,
      code: courses.code,
      instructor: courses.instructor,
      color: courses.color,
    })
    .from(courses)
    .innerJoin(semesters, eq(courses.semesterId, semesters.id))
    .where(and(eq(courses.id, courseId), eq(semesters.userId, userId)));

  if (!course) return null;

  const rows = await db
    .select({
      id: deliverables.id,
      title: deliverables.title,
      type: deliverables.type,
      dueDate: deliverables.dueDate,
      dueTime: deliverables.dueTime,
      weightPercent: deliverables.weightPercent,
      notes: deliverables.notes,
      confidence: deliverables.confidence,
      ambiguityReason: deliverables.ambiguityReason,
      seriesId: deliverables.seriesId,
    })
    .from(deliverables)
    .where(eq(deliverables.courseId, courseId))
    .orderBy(asc(deliverables.dueDate), asc(deliverables.createdAt));

  return { ...course, deliverables: rows };
}

export type CourseDetail = NonNullable<Awaited<ReturnType<typeof getCourseDetail>>>;
export type CourseDeliverable = CourseDetail["deliverables"][number];

// Current name/code for a course, scoped by userId (ownership + the old label, to
// detect a label change on edit). Returns null when the course isn't the user's.
export async function getCourseNameCode(userId: UserId, courseId: CourseId) {
  const [row] = await db
    .select({ name: courses.name, code: courses.code })
    .from(courses)
    .innerJoin(semesters, eq(courses.semesterId, semesters.id))
    .where(and(eq(courses.id, courseId), eq(semesters.userId, userId)));
  return row ?? null;
}

// Persists course header fields. Ownership is verified by the caller (it reads the
// old label first), so this updates by id alone — mirrors the deliverable edit.
export async function updateCourseFields(
  courseId: CourseId,
  fields: { name: string; code: string | null; instructor: string | null },
): Promise<void> {
  await db.update(courses).set(fields).where(eq(courses.id, courseId));
}

// Synced deliverables of a course (event id + title), for re-patching the
// "<label> · <title>" summary after a course rename. Scoped by userId.
export async function getSyncedDeliverablesForCourse(userId: UserId, courseId: CourseId) {
  const rows = await db
    .select({ googleEventId: deliverables.googleEventId, title: deliverables.title })
    .from(deliverables)
    .innerJoin(courses, eq(deliverables.courseId, courses.id))
    .innerJoin(semesters, eq(courses.semesterId, semesters.id))
    .where(
      and(
        eq(courses.id, courseId),
        eq(semesters.userId, userId),
        isNotNull(deliverables.googleEventId),
      ),
    );
  return rows.map((r) => ({ googleEventId: r.googleEventId as string, title: r.title }));
}

// Context for re-parsing a course (§7.1): its stored syllabus text plus the
// semester dates + timezone the parser needs to resolve relative dates. Scoped to
// userId through the course → semester → user join (null when not owned).
export async function getCourseForReparse(userId: UserId, courseId: CourseId) {
  const [row] = await db
    .select({
      syllabusText: courses.originalSyllabusText,
      semesterStart: semesters.startDate,
      semesterEnd: semesters.endDate,
      timezone: users.timezone,
    })
    .from(courses)
    .innerJoin(semesters, eq(courses.semesterId, semesters.id))
    .innerJoin(users, eq(semesters.userId, users.id))
    .where(and(eq(courses.id, courseId), eq(semesters.userId, userId)));
  return row ?? null;
}

// Re-parse replacement (§7.1): swap a course's deliverables for a freshly parsed
// set. Old rows are deleted and the newly expanded rows inserted in one batch, so
// the course is never left empty mid-swap. The caller deletes the old Calendar
// events first (cascadeDeleteEvents) and verifies ownership; this is the DB half.
export async function replaceCourseDeliverables(
  courseId: CourseId,
  items: ParseResult["deliverables"],
): Promise<void> {
  const rows = toDeliverableRows(items, randomUUID).map((r) => ({
    ...r,
    id: randomUUID() as DeliverableId,
    courseId,
  }));
  const del = db.delete(deliverables).where(eq(deliverables.courseId, courseId));
  if (rows.length > 0) {
    await db.batch([del, db.insert(deliverables).values(rows)]);
  } else {
    await del;
  }
}
