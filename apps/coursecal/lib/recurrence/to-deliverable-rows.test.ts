import type { Deliverable } from "@coursecal/syllabus-parser";
import { describe, expect, it } from "vitest";
import { toDeliverableRows } from "./to-deliverable-rows";

// Deterministic id factory so the shared series_id is assertable.
function counter() {
  let n = 0;
  return () => `series-${++n}`;
}

const oneOff: Deliverable = {
  title: "Final exam",
  type: "exam",
  due_date: "2026-12-10",
  due_time: "09:00",
  weight_percent: 40,
  notes: null,
  recurrence: null,
  confidence: "high",
  ambiguity_reason: null,
};

// days_of_week null → anchor on the start weekday, so occurrences are start +0/7/
// 14/21 days regardless of calendar weekday: 4 dates, deterministic.
const weeklyQuiz: Deliverable = {
  title: "Weekly quiz",
  type: "quiz",
  due_date: null,
  due_time: "23:59",
  weight_percent: 12,
  notes: null,
  recurrence: {
    unit: "week",
    interval: 1,
    days_of_week: null,
    start_date: "2026-09-07",
    end_date: "2026-09-28",
    count: null,
  },
  confidence: "high",
  ambiguity_reason: null,
};

describe("toDeliverableRows", () => {
  it("keeps a one-off as a single row with null series_id", () => {
    const rows = toDeliverableRows([oneOff], counter());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Final exam",
      dueDate: "2026-12-10",
      weightPercent: "40.00",
      seriesId: null,
    });
  });

  it("expands a recurring item, splits weight evenly, shares one series_id", () => {
    const rows = toDeliverableRows([weeklyQuiz], counter());
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.dueDate)).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
    // 12% / 4 = 3.00 each.
    expect(rows.every((r) => r.weightPercent === "3.00")).toBe(true);
    // All instances carry the natural type and the same generated series_id.
    expect(rows.every((r) => r.type === "quiz")).toBe(true);
    expect(new Set(rows.map((r) => r.seriesId))).toEqual(new Set(["series-1"]));
    expect(rows.every((r) => r.dueTime === "23:59")).toBe(true);
  });

  it("gives each recurring item its own series_id", () => {
    const rows = toDeliverableRows([weeklyQuiz, weeklyQuiz], counter());
    const seriesIds = new Set(rows.map((r) => r.seriesId));
    expect(seriesIds).toEqual(new Set(["series-1", "series-2"]));
  });
});
