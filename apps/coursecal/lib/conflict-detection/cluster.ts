import {
  clusterMinScore,
  clusterSizeThreshold,
  clusterWindowDays,
  crossCourseMultiplier,
} from "./constants";
import type { CourseId } from "@/lib/db/ids";
import type { Cluster, ConflictDeliverable } from "./types";
import { toUTC, workloadScore } from "./workload";

// Layer 2 (clustering). Greedy, non-overlapping grouping over date-sorted items: a
// group keeps absorbing later deliverables while they fall within clusterWindowDays
// of the group's first item; the first item beyond that span opens a new group. A
// cluster therefore spans at most clusterWindowDays. Non-overlapping clusters map
// cleanly to "grouped items with a warning" in the timeline. Tradeoffs in README.md.

const MS_PER_DAY = 86_400_000;

function buildCluster(group: ConflictDeliverable[]): Cluster {
  const courseIds = [...new Set<CourseId>(group.map((d) => d.courseId))];
  const workload = group.reduce((sum, d) => sum + workloadScore(d), 0);
  const crossCourse = courseIds.length > 1;
  return {
    // group is date-sorted, so the first/last items carry the span bounds.
    start: group[0]!.dueDate,
    end: group[group.length - 1]!.dueDate,
    deliverableIds: group.map((d) => d.id),
    courseIds,
    crossCourse,
    severity: crossCourse ? workload * crossCourseMultiplier : workload,
  };
}

/** Find clusters of clusterSizeThreshold+ deliverables within a clusterWindowDays
 * span, counting only items scoring clusterMinScore or more. Cross-course clusters
 * get the context-switching multiplier on severity. */
export function findClusters(deliverables: ConflictDeliverable[]): Cluster[] {
  const sorted = deliverables
    .filter((d) => workloadScore(d) >= clusterMinScore)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const clusters: Cluster[] = [];
  let group: ConflictDeliverable[] = [];

  const flush = () => {
    if (group.length >= clusterSizeThreshold) clusters.push(buildCluster(group));
    group = [];
  };

  for (const d of sorted) {
    if (group.length === 0) {
      group = [d];
      continue;
    }
    const spanDays = (toUTC(d.dueDate) - toUTC(group[0]!.dueDate)) / MS_PER_DAY;
    if (spanDays <= clusterWindowDays) {
      group.push(d);
    } else {
      flush();
      group = [d];
    }
  }
  flush();

  return clusters;
}
