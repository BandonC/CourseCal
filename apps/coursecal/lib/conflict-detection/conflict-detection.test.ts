import { describe, expect, it } from "vitest";
import type { CourseId, DeliverableId } from "@/lib/db/ids";
import { detectConflicts, workloadScore } from "./index";
import type { ConflictDeliverable, SemesterBounds } from "./types";

// 2026-09-01 is a Tuesday. Week 1 = 09-01..09-07, week 2 = 09-08..09-14, etc.
const semester: SemesterBounds = { start: "2026-09-01", end: "2026-12-01" };

let seq = 0;
function deliverable(over: Partial<ConflictDeliverable> = {}): ConflictDeliverable {
  seq += 1;
  return {
    id: `d${seq}` as DeliverableId,
    courseId: "course-a" as CourseId,
    type: "assignment",
    dueDate: "2026-09-02",
    weightPercent: null,
    ...over,
  };
}

describe("workloadScore", () => {
  it("uses the known grade weight when present", () => {
    expect(workloadScore(deliverable({ type: "quiz", weightPercent: 40 }))).toBe(40);
  });

  it("falls back to the type default when weight is null", () => {
    expect(workloadScore(deliverable({ type: "exam", weightPercent: null }))).toBe(25);
    expect(workloadScore(deliverable({ type: "reading", weightPercent: null }))).toBe(3);
  });
});

describe("Layer 1 — week density", () => {
  it("flags a hell week from a single heavy known weight", () => {
    const report = detectConflicts(
      [deliverable({ dueDate: "2026-09-02", weightPercent: 30 })],
      semester,
    );
    expect(report.weeks[0]!.workload).toBe(30);
    expect(report.weeks[0]!.heavy).toBe(true);
  });

  it("flags a hell week from stacked type-default weights", () => {
    // exam (25) + assignment (10) = 35 ≥ 30, both in week 1.
    const report = detectConflicts(
      [
        deliverable({ type: "exam", dueDate: "2026-09-03", weightPercent: null }),
        deliverable({ type: "assignment", dueDate: "2026-09-04", weightPercent: null }),
      ],
      semester,
    );
    expect(report.weeks[0]!.workload).toBe(35);
    expect(report.weeks[0]!.count).toBe(2);
    expect(report.weeks[0]!.heavy).toBe(true);
  });

  it("does not flag a clean week", () => {
    const report = detectConflicts(
      [deliverable({ type: "quiz", dueDate: "2026-09-02", weightPercent: 5 })],
      semester,
    );
    expect(report.weeks[0]!.workload).toBe(5);
    expect(report.weeks[0]!.heavy).toBe(false);
  });

  it("buckets deliverables into the correct week and covers the whole term", () => {
    const report = detectConflicts(
      [deliverable({ dueDate: "2026-09-08", weightPercent: 10 })], // first day of week 2
      semester,
    );
    expect(report.weeks[0]!.count).toBe(0);
    expect(report.weeks[1]!.count).toBe(1);
    expect(report.weeks[0]!.start).toBe("2026-09-01");
    expect(report.weeks[0]!.end).toBe("2026-09-07");
    expect(report.weeks.at(-1)!.end).toBe("2026-12-01"); // final week capped at end
  });
});

describe("Layer 2 — clustering", () => {
  it("flags a cross-course cluster and applies the multiplier", () => {
    const report = detectConflicts(
      [
        deliverable({ courseId: "course-a" as CourseId, type: "assignment", dueDate: "2026-10-05", weightPercent: 10 }),
        deliverable({ courseId: "course-b" as CourseId, type: "exam", dueDate: "2026-10-07", weightPercent: 20 }),
        deliverable({ courseId: "course-a" as CourseId, type: "quiz", dueDate: "2026-10-09", weightPercent: 5 }),
      ],
      semester,
    );
    expect(report.clusters).toHaveLength(1);
    const c = report.clusters[0]!;
    expect(c.crossCourse).toBe(true);
    expect(c.courseIds).toEqual(["course-a", "course-b"]);
    expect(c.start).toBe("2026-10-05");
    expect(c.end).toBe("2026-10-09");
    // (10 + 20 + 5) × 1.5
    expect(c.severity).toBe(52.5);
  });

  it("flags a single-course cluster without the multiplier", () => {
    const report = detectConflicts(
      [
        deliverable({ courseId: "course-a" as CourseId, dueDate: "2026-10-05", weightPercent: 10 }),
        deliverable({ courseId: "course-a" as CourseId, dueDate: "2026-10-06", weightPercent: 10 }),
        deliverable({ courseId: "course-a" as CourseId, dueDate: "2026-10-07", weightPercent: 10 }),
      ],
      semester,
    );
    expect(report.clusters).toHaveLength(1);
    expect(report.clusters[0]!.crossCourse).toBe(false);
    expect(report.clusters[0]!.severity).toBe(30);
  });

  it("does not cluster fewer than the size threshold", () => {
    const report = detectConflicts(
      [
        deliverable({ dueDate: "2026-10-05" }),
        deliverable({ dueDate: "2026-10-06" }),
      ],
      semester,
    );
    expect(report.clusters).toHaveLength(0);
  });

  it("does not cluster items below clusterMinScore (weekly labs, participation)", () => {
    const report = detectConflicts(
      [
        deliverable({ courseId: "course-a" as CourseId, dueDate: "2026-10-06", weightPercent: 0.64 }),
        deliverable({ courseId: "course-b" as CourseId, type: "quiz", dueDate: "2026-10-07", weightPercent: 1.25 }),
        deliverable({ courseId: "course-a" as CourseId, type: "participation", dueDate: "2026-10-08", weightPercent: 0.67 }),
      ],
      semester,
    );
    expect(report.clusters).toHaveLength(0);
    // Still part of the week's load (Layer 1 is unaffected).
    expect(report.weeks.find((w) => w.start === "2026-10-06")!.workload).toBeCloseTo(2.56);
  });

  it("still clusters a real crunch, leaving the small items out of it", () => {
    const lab = deliverable({ courseId: "course-a" as CourseId, dueDate: "2026-10-05", weightPercent: 0.64 });
    const midterm = deliverable({ courseId: "course-a" as CourseId, type: "exam", dueDate: "2026-10-06", weightPercent: 30 });
    const assignment = deliverable({ courseId: "course-b" as CourseId, dueDate: "2026-10-07", weightPercent: 8 });
    const quiz = deliverable({ courseId: "course-c" as CourseId, type: "quiz", dueDate: "2026-10-08", weightPercent: null });
    const report = detectConflicts([lab, midterm, assignment, quiz], semester);
    expect(report.clusters).toHaveLength(1);
    expect(report.clusters[0]!.deliverableIds).toEqual([midterm.id, assignment.id, quiz.id]);
  });

  it("does not cluster items spread beyond the window", () => {
    // 6 days apart each → no 3 within a 5-day span.
    const report = detectConflicts(
      [
        deliverable({ dueDate: "2026-10-01" }),
        deliverable({ dueDate: "2026-10-07" }),
        deliverable({ dueDate: "2026-10-13" }),
      ],
      semester,
    );
    expect(report.clusters).toHaveLength(0);
  });
});
