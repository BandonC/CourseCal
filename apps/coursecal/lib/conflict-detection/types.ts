import type { DeliverableType } from "@coursecal/syllabus-parser";
import type { CourseId, DeliverableId } from "@/lib/db/ids";

// The algorithm is pure and DB-agnostic: it consumes the minimal shape below, not
// Drizzle rows. The caller (a server component) fetches userId-scoped deliverables,
// excludes dateless items (§7.1 — they skip weekly sums), and maps to these.

/** A dated, persisted deliverable, reduced to what the algorithm needs. */
export type ConflictDeliverable = {
  id: DeliverableId;
  courseId: CourseId;
  type: DeliverableType;
  dueDate: string; // ISO YYYY-MM-DD (never null — dateless items are excluded upstream)
  weightPercent: number | null;
};

/** Semester boundaries used to bucket deliverables into weeks. */
export type SemesterBounds = { start: string; end: string }; // ISO YYYY-MM-DD

/** Layer 1: one bucketed week of the semester. */
export type WeekDensity = {
  index: number; // 1-based week number from the semester start
  start: string; // ISO, inclusive
  end: string; // ISO, inclusive (capped at the semester end for the final week)
  workload: number; // summed workload score for the week
  count: number; // dated deliverables falling in the week
  heavy: boolean; // workload >= heavyWeekThreshold
};

/** Layer 2: a window of clustered deliverables. */
export type Cluster = {
  start: string; // ISO of the earliest deliverable in the cluster
  end: string; // ISO of the latest
  deliverableIds: DeliverableId[];
  courseIds: CourseId[]; // distinct courses represented, in first-seen order
  crossCourse: boolean; // spans more than one course
  severity: number; // summed workload, × crossCourseMultiplier when crossCourse
};

export type ConflictReport = {
  weeks: WeekDensity[];
  clusters: Cluster[];
};
