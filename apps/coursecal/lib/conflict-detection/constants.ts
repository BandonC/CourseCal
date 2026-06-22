// Conflict detection parameters (COURSECAL.md §12.4, apps/coursecal/CLAUDE.md).
// These are the only knobs — there is no user-facing tuning UI in v1. Defaults and
// their rationale are recorded in DECISIONS.md and this module's README.md. Do not
// change a value without updating the unit tests that pin these behaviours.

import type { DeliverableType } from "@coursecal/syllabus-parser";

/**
 * Layer 1 (density): a week whose summed workload score meets or exceeds this is
 * flagged a "hell week". The scale is grade-weight points (see WORKLOAD_DEFAULTS):
 * ~a 30% midterm, or an equivalent spread across courses, landing in one week.
 */
export const heavyWeekThreshold = 30;

/** Layer 2 (clustering): the sliding window, in days, that groups nearby items. */
export const clusterWindowDays = 5;

/** Layer 2: a window holding at least this many dated deliverables is a cluster. */
export const clusterSizeThreshold = 3;

/**
 * Layer 2: clusters spanning more than one course are multiplied by this, modelling
 * the context-switching cost of juggling deadlines across courses at once.
 */
export const crossCourseMultiplier = 1.5;

/**
 * Workload score for a deliverable whose grade weight is unknown. When
 * weight_percent IS known it is used directly; these are the type-based fallbacks
 * (§12.4 ordering: exam > project > assignment > quiz > reading), on the same
 * "grade-weight points" scale so known and inferred weights blend in one sum.
 * `participation` is dateless (§7.1) → it never reaches the timeline/weekly sums,
 * but it carries a value for completeness over the DeliverableType union.
 */
export const WORKLOAD_DEFAULTS: Record<DeliverableType, number> = {
  exam: 25,
  project: 20,
  presentation: 15,
  assignment: 10,
  quiz: 5,
  reading: 3,
  participation: 5,
  other: 5,
};
