// Conflict detection (COURSECAL.md §12.4) — Layers 1 (week density) + 2 (clustering)
// only; Layer 3 (start-early recommendations) is out of scope for v1. The algorithm
// is a pure function over a semester's dated deliverables. See README.md.

import { findClusters } from "./cluster";
import { weekDensities } from "./workload";
import type { ConflictDeliverable, ConflictReport, SemesterBounds } from "./types";

/** Run Layers 1 + 2 over a semester's dated deliverables. Pure: same inputs →
 * same report, no ambient time or I/O. The caller fetches userId-scoped rows and
 * excludes dateless items (§7.1) before calling. */
export function detectConflicts(
  deliverables: ConflictDeliverable[],
  semester: SemesterBounds,
): ConflictReport {
  return {
    weeks: weekDensities(deliverables, semester),
    clusters: findClusters(deliverables),
  };
}

export {
  heavyWeekThreshold,
  clusterWindowDays,
  clusterSizeThreshold,
  clusterMinScore,
  crossCourseMultiplier,
  WORKLOAD_DEFAULTS,
} from "./constants";
export { workloadScore } from "./workload";
export type {
  Cluster,
  ConflictDeliverable,
  ConflictReport,
  SemesterBounds,
  WeekDensity,
} from "./types";
