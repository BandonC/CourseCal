import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { ParseResult } from "@coursecal/syllabus-parser";
import { courseColorForIndex } from "@/lib/courses/colors";
import { db } from "@/lib/db";
import type { CourseId, DeliverableId, SemesterId, UserId } from "@/lib/db/ids";
import { courses, deliverables, semesters } from "@/lib/db/schema";
import { toDeliverableRows } from "@/lib/recurrence/to-deliverable-rows";

type CourseInput = {
  result: ParseResult;
  syllabusText: string;
  color: string;
};

type SaveSemesterInput = {
  semesterName: string;
  semesterStart: string;
  semesterEnd: string;
  courses: CourseInput[];
};

// Persists a new semester, its courses, and every course's expanded deliverable
// rows in one db.batch — neon-http runs the batch as a single server-side
// transaction, so the FK order (semester → courses → deliverables) is satisfied
// within it and the whole save is atomic (abandoning before export, or one course
// failing, leaves no orphan semester). UUIDs are generated app-side (the batch
// can't thread a RETURNING id between statements). Scoped to userId via the
// semester row. Phase 4: one semester holds N courses (the multi-syllabus flow);
// adding a course to an *existing* semester is a separate Phase-5 action.
export async function createSemesterWithCourses(
  userId: UserId,
  input: SaveSemesterInput,
): Promise<{ semesterId: SemesterId; courseIds: CourseId[] }> {
  const semesterId = randomUUID() as SemesterId;

  const courseIds: CourseId[] = [];
  const courseValues: (typeof courses.$inferInsert)[] = [];
  const deliverableRows: (typeof deliverables.$inferInsert)[] = [];

  for (const c of input.courses) {
    const courseId = randomUUID() as CourseId;
    courseIds.push(courseId);
    courseValues.push({
      id: courseId,
      semesterId,
      name: c.result.course.name,
      code: c.result.course.code,
      instructor: c.result.course.instructor,
      color: c.color,
      originalSyllabusText: c.syllabusText,
    });
    for (const r of toDeliverableRows(c.result.deliverables, randomUUID)) {
      deliverableRows.push({ ...r, id: randomUUID() as DeliverableId, courseId });
    }
  }

  const insertSemester = db.insert(semesters).values({
    id: semesterId,
    userId,
    name: input.semesterName,
    startDate: input.semesterStart,
    endDate: input.semesterEnd,
  });
  const insertCourses = db.insert(courses).values(courseValues);

  if (deliverableRows.length > 0) {
    await db.batch([
      insertSemester,
      insertCourses,
      db.insert(deliverables).values(deliverableRows),
    ]);
  } else {
    await db.batch([insertSemester, insertCourses]);
  }

  return { semesterId, courseIds };
}

type AddCourseInput = { result: ParseResult; syllabusText: string };

// Adds course(s) to an existing semester (§3.3 / the Phase-5 deferral in
// DECISIONS 2026-06-22). Ownership is verified against the semester row scoped by
// userId — a semester that isn't the user's returns null (the action 404s). New
// course colors continue from the existing course count so they stay distinct
// across the whole semester (matching saveSemester's per-index assignment, just
// offset). Courses + expanded deliverable rows are written in one batch (FK order
// holds — the semester already exists). UUIDs are app-generated (the batch can't
// thread a RETURNING id between statements).
export async function addCoursesToSemester(
  userId: UserId,
  semesterId: SemesterId,
  inputCourses: AddCourseInput[],
): Promise<{ semesterId: SemesterId; courseIds: CourseId[] } | null> {
  const [owner] = await db
    .select({ id: semesters.id })
    .from(semesters)
    .where(and(eq(semesters.id, semesterId), eq(semesters.userId, userId)));
  if (!owner) return null;

  const existing = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.semesterId, semesterId));
  const offset = existing.length;

  const courseIds: CourseId[] = [];
  const courseValues: (typeof courses.$inferInsert)[] = [];
  const deliverableRows: (typeof deliverables.$inferInsert)[] = [];

  inputCourses.forEach((c, i) => {
    const courseId = randomUUID() as CourseId;
    courseIds.push(courseId);
    courseValues.push({
      id: courseId,
      semesterId,
      name: c.result.course.name,
      code: c.result.course.code,
      instructor: c.result.course.instructor,
      color: courseColorForIndex(offset + i),
      originalSyllabusText: c.syllabusText,
    });
    for (const r of toDeliverableRows(c.result.deliverables, randomUUID)) {
      deliverableRows.push({ ...r, id: randomUUID() as DeliverableId, courseId });
    }
  });

  if (deliverableRows.length > 0) {
    await db.batch([
      db.insert(courses).values(courseValues),
      db.insert(deliverables).values(deliverableRows),
    ]);
  } else {
    await db.insert(courses).values(courseValues);
  }

  return { semesterId, courseIds };
}

// Lean semester lookup (id + name + dates) scoped by userId, for pages that only
// need the header/context — e.g. the add-courses flow, which feeds the dates into
// the parse context without loading every deliverable.
export async function getSemesterBasics(userId: UserId, semesterId: SemesterId) {
  const [row] = await db
    .select({
      id: semesters.id,
      name: semesters.name,
      startDate: semesters.startDate,
      endDate: semesters.endDate,
    })
    .from(semesters)
    .where(and(eq(semesters.id, semesterId), eq(semesters.userId, userId)));
  return row ?? null;
}

// Loads a semester with its courses and deliverables for the timeline view, scoped
// by userId (the where clause filters on both id AND userId, so another user's
// semester is indistinguishable from a missing one → the page 404s). Only the
// columns the timeline + conflict detection need are selected (no syllabus text).
export async function getSemesterTimeline(userId: UserId, semesterId: SemesterId) {
  return db.query.semesters.findFirst({
    where: and(eq(semesters.id, semesterId), eq(semesters.userId, userId)),
    columns: { id: true, name: true, startDate: true, endDate: true },
    with: {
      courses: {
        columns: { id: true, name: true, code: true, color: true },
        with: {
          deliverables: {
            columns: {
              id: true,
              courseId: true,
              title: true,
              type: true,
              dueDate: true,
              dueTime: true,
              weightPercent: true,
              confidence: true,
            },
          },
        },
      },
    },
  });
}

export type SemesterTimelineData = NonNullable<
  Awaited<ReturnType<typeof getSemesterTimeline>>
>;

// Dashboard: every semester (newest first) with its courses and per-course counts
// — total deliverables, "to check" (the model's medium/low-confidence items), and
// "unsynced" (dated rows with no google_event_id, i.e. a saved-but-unexported or
// resumable course). Scoped by userId on both queries. Counts are computed in SQL
// (filtered aggregates) rather than over-fetching every deliverable row. The
// course aggregate groups by courses.id (its PK), so Postgres lets us select the
// other course columns ungrouped. A course with no deliverables left-joins to
// nulls, which the FILTER predicates exclude → all counts read 0.
export async function getDashboardData(userId: UserId) {
  const sems = await db
    .select({
      id: semesters.id,
      name: semesters.name,
      startDate: semesters.startDate,
      endDate: semesters.endDate,
    })
    .from(semesters)
    .where(eq(semesters.userId, userId))
    .orderBy(desc(semesters.startDate), desc(semesters.createdAt));

  if (sems.length === 0) return [];

  const courseRows = await db
    .select({
      id: courses.id,
      semesterId: courses.semesterId,
      name: courses.name,
      code: courses.code,
      color: courses.color,
      total: sql<number>`count(${deliverables.id})`.mapWith(Number),
      toCheck: sql<number>`count(*) filter (where ${deliverables.confidence} <> 'high')`.mapWith(
        Number,
      ),
      unsynced:
        sql<number>`count(*) filter (where ${deliverables.dueDate} is not null and ${deliverables.googleEventId} is null)`.mapWith(
          Number,
        ),
    })
    .from(courses)
    .innerJoin(semesters, eq(courses.semesterId, semesters.id))
    .leftJoin(deliverables, eq(deliverables.courseId, courses.id))
    .where(eq(semesters.userId, userId))
    .groupBy(courses.id)
    .orderBy(courses.createdAt);

  return sems.map((s) => ({
    ...s,
    courses: courseRows.filter((c) => c.semesterId === s.id),
  }));
}

export type DashboardSemester = Awaited<ReturnType<typeof getDashboardData>>[number];
export type DashboardCourse = DashboardSemester["courses"][number];
