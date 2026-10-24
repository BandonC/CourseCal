# conflict-detection

Flags scheduling pressure in a semester so the timeline can surface it: **hell
weeks** (Layer 1) and **clustered deadlines** (Layer 2). Implements COURSECAL.md
§12.4. Layer 3 ("start-early recommendations") is out of scope for v1.

`detectConflicts(deliverables, semester)` is a **pure function** — same inputs
produce the same report, no ambient time, no I/O. The caller (a server component)
fetches `userId`-scoped deliverables, excludes dateless items (§7.1 — they count
toward course weight totals but skip weekly workload sums), maps them to
`ConflictDeliverable`, and passes the semester bounds.

## Workload model

Every deliverable gets a **workload score** on one "grade-weight points" scale:

- **Known `weight_percent`** → used directly (a 30% midterm scores 30).
- **Unknown** → a type-based default, so inferred and known weights blend in one
  sum. Ordering follows §12.4 (exam > project > assignment > quiz > reading):

  | type | exam | project | presentation | assignment | quiz | reading | other | participation |
  |------|------|---------|--------------|------------|------|---------|-------|---------------|
  | pts  | 25   | 20      | 15           | 10         | 5    | 3       | 5     | 5\*           |

  \* `participation` is dateless and never reaches the timeline/weekly sums; it
  carries a value only to keep the map total over the `DeliverableType` union.

## Layer 1 — week density

Deliverables are bucketed into consecutive 7-day weeks from the semester start.
Each week's scores are summed; a week at/above `heavyWeekThreshold` is a **hell
week**. The final week is capped at the semester end date.

## Layer 2 — clustering

Greedy, non-overlapping grouping over date-sorted deliverables: a group keeps
absorbing later items while they fall within `clusterWindowDays` of the group's
**first** item; the first item beyond that span starts a new group. A group of at
least `clusterSizeThreshold` items is a cluster. Clusters spanning more than one
course have their severity multiplied by `crossCourseMultiplier` (context-switching
cost).

**Tradeoffs.** Greedy-from-first is deterministic and yields non-overlapping
clusters that map cleanly to "grouped items with a warning" in the UI. It can miss
a dense window that straddles a group boundary (a sliding-window maximum would
catch more, at the cost of overlapping clusters and a fuzzier visual). For v1 this
is the right altitude. Layer 1 separately captures sustained week-level intensity,
so a low-stakes cluster (e.g. three readings) surfaces as a low-severity cluster
rather than a hell week.

**Small items don't cluster.** Only deliverables scoring at least
`clusterMinScore` (2) count toward a cluster. Recurring small items like a 0.64%
weekly lab or 0.67% participation would otherwise form a "cluster" almost every
week, so the warning stopped meaning anything. They still count toward the week's
Layer 1 load, so a week overloaded by many small items still reads as busy; it
just isn't a cluster. Unweighted items count by type default (a quiz is 5), so
they qualify.

The window is inclusive of its endpoints: items whose due dates differ by **≤
`clusterWindowDays`** join the same cluster.

## Parameters

All knobs live in `constants.ts` (no magic numbers at call sites, no tuning UI in
v1). Defaults and rationale are mirrored in `DECISIONS.md`.

| parameter | default | meaning |
|---|---|---|
| `heavyWeekThreshold` | 30 | week workload ≥ this ⇒ hell week |
| `clusterWindowDays` | 5 | max span (days) of a cluster |
| `clusterSizeThreshold` | 3 | min deliverables in a window to be a cluster |
| `clusterMinScore` | 2 | min workload score for an item to count toward a cluster |
| `crossCourseMultiplier` | 1.5 | severity multiplier for multi-course clusters |

Changing any default means updating `conflict-detection.test.ts`, which pins the
hell-week, clean-week, and cross-course-cluster scenarios.
