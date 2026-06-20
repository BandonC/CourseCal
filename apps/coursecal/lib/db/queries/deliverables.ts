import "server-only";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import type { CourseId, DeliverableId, UserId } from "@/lib/db/ids";
import { courses, deliverables, semesters, users } from "@/lib/db/schema";

// Deliverables ready to sync to Calendar: dated and not yet synced (no
// google_event_id), so re-running an export resumes where it left off. The join
// chain to users enforces userId scoping — a user can only sync their own rows.
export async function getSyncableDeliverables(userId: UserId, courseId: CourseId) {
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
        eq(deliverables.courseId, courseId),
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
