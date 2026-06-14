import { describe, it, expect } from "vitest";
import { resolveExtraction } from "../src/resolution";
import { ParseResultSchema } from "../src/schema";
import type { DateResolutionContext } from "../src/dates";

const ctx: DateResolutionContext = {
  semesterStart: "2026-09-07",
  semesterEnd: "2026-12-07",
};

const course = {
  name: "Databases",
  code: null,
  instructor: null,
  semester_start: "2026-09-07",
  semester_end: "2026-12-07",
};

const base = {
  title: "Item",
  type: "assignment",
  due_date: null,
  due_date_expression: null,
  due_time: null,
  weight_percent: null,
  notes: null,
  recurrence: null,
  confidence: "high",
  ambiguity_reason: null,
};

function run(d: Record<string, unknown>, c: DateResolutionContext = ctx) {
  const result = resolveExtraction({ course, deliverables: [d] } as never, c);
  // The mapping must always produce schema-valid public output.
  expect(ParseResultSchema.safeParse(result).success).toBe(true);
  return result.deliverables[0]!;
}

describe("resolveExtraction — one-off dates", () => {
  it("keeps an absolute date and high confidence", () => {
    const d = run({ ...base, due_date: "2026-10-20", confidence: "high" });
    expect(d.due_date).toBe("2026-10-20");
    expect(d.confidence).toBe("high");
    expect(d.ambiguity_reason).toBeNull();
  });

  it("resolves a relative expression and caps confidence at medium", () => {
    const d = run({
      ...base,
      due_date_expression: "Week 3",
      confidence: "high",
    });
    expect(d.due_date).toBe("2026-09-21");
    expect(d.confidence).toBe("medium");
    expect(d.ambiguity_reason).toBeTruthy();
  });

  it("leaves an unresolvable expression dateless and low", () => {
    const d = run({
      ...base,
      due_date_expression: "sometime soon",
      confidence: "high",
    });
    expect(d.due_date).toBeNull();
    expect(d.confidence).toBe("low");
    expect(d.ambiguity_reason).toContain("sometime soon");
  });

  it("fills an ambiguous (no-class-day) date but marks it low", () => {
    const d = run(
      { ...base, due_date_expression: "Week 3", confidence: "high" },
      { ...ctx, holidays: ["2026-09-21"] },
    );
    expect(d.due_date).toBe("2026-09-21");
    expect(d.confidence).toBe("low");
  });

  it("passes a dateless item through unchanged", () => {
    const d = run({
      ...base,
      type: "participation",
      weight_percent: 10,
      confidence: "high",
    });
    expect(d.due_date).toBeNull();
    expect(d.recurrence).toBeNull();
    expect(d.confidence).toBe("high");
  });
});

describe("resolveExtraction — recurrence", () => {
  const rec = {
    unit: "week",
    interval: 1,
    days_of_week: ["monday"],
    start_date: "2026-09-14",
    end_date: null,
    count: 10,
  };

  it("keeps a bounded, anchored recurrence and nulls the due_date", () => {
    const d = run({
      ...base,
      type: "quiz",
      recurrence: rec,
      confidence: "medium",
      ambiguity_reason: "weekly",
    });
    expect(d.recurrence).not.toBeNull();
    expect(d.due_date).toBeNull();
    expect(d.recurrence?.days_of_week).toEqual(["monday"]);
  });

  it("normalizes an empty days_of_week array to null", () => {
    const d = run({
      ...base,
      type: "quiz",
      recurrence: { ...rec, days_of_week: [] },
    });
    expect(d.recurrence?.days_of_week).toBeNull();
  });

  it("drops a recurrence with no start date and marks it low", () => {
    const d = run({
      ...base,
      type: "quiz",
      recurrence: { ...rec, start_date: null },
    });
    expect(d.recurrence).toBeNull();
    expect(d.confidence).toBe("low");
    expect(d.ambiguity_reason).toBeTruthy();
  });

  it("drops an unbounded recurrence (no end_date and no count)", () => {
    const d = run({
      ...base,
      type: "quiz",
      recurrence: { ...rec, end_date: null, count: null },
    });
    expect(d.recurrence).toBeNull();
    expect(d.confidence).toBe("low");
  });
});
