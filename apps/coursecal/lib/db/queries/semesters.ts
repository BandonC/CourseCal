import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { ParseResult } from "@coursecal/syllabus-parser";
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
