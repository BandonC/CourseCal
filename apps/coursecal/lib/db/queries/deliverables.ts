import "server-only";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import type { DeliverableId, SemesterId, UserId } from "@/lib/db/ids";
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

export async function setGoogleEventId(id: DeliverableId, eventId: string): Promise<void> {
  await db
    .update(deliverables)
    .set({ googleEventId: eventId, updatedAt: new Date() })
    .where(eq(deliverables.id, id));
}
