import "server-only";

import { randomUUID } from "node:crypto";
import type { ParseResult } from "@coursecal/syllabus-parser";
import { db } from "@/lib/db";
import type { CourseId, DeliverableId, SemesterId, UserId } from "@/lib/db/ids";
import { courses, deliverables, semesters } from "@/lib/db/schema";
import { toDeliverableRows } from "@/lib/recurrence/to-deliverable-rows";

type SaveSemesterInput = {
  semesterName: string;
  semesterStart: string;
  semesterEnd: string;
  syllabusText: string;
  color: string;
  result: ParseResult;
};

// Persists a new semester, its single course, and the expanded deliverable rows
// in one db.batch — neon-http runs the batch as a single server-side transaction,
// so the FK order (semester → course → deliverables) is satisfied within it and
// the whole save is atomic. UUIDs are generated app-side (the batch can't thread
// a RETURNING id between statements). Scoped to userId via the semester row.
export async function createSemesterWithCourse(
  userId: UserId,
  input: SaveSemesterInput,
): Promise<{ semesterId: SemesterId; courseId: CourseId }> {
  const semesterId = randomUUID() as SemesterId;
  const courseId = randomUUID() as CourseId;

  const rows = toDeliverableRows(input.result.deliverables, randomUUID).map((r) => ({
    ...r,
    id: randomUUID() as DeliverableId,
    courseId,
  }));

  const insertSemester = db.insert(semesters).values({
    id: semesterId,
    userId,
    name: input.semesterName,
    startDate: input.semesterStart,
    endDate: input.semesterEnd,
  });

  const insertCourse = db.insert(courses).values({
    id: courseId,
    semesterId,
    name: input.result.course.name,
    code: input.result.course.code,
    instructor: input.result.course.instructor,
    color: input.color,
    originalSyllabusText: input.syllabusText,
  });

  if (rows.length > 0) {
    await db.batch([insertSemester, insertCourse, db.insert(deliverables).values(rows)]);
  } else {
    await db.batch([insertSemester, insertCourse]);
  }

  return { semesterId, courseId };
}
