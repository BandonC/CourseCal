import { describe, it, expect } from "vitest";
import {
  ParseResultSchema,
  DeliverableSchema,
  RecurrenceSchema,
} from "../src/schema";

const validCourse = {
  name: "Intro to Databases",
  code: "CS 348",
  instructor: "Dr. Ada Lovelace",
  semester_start: "2026-09-08",
  semester_end: "2026-12-07",
};

const oneOffExam = {
  title: "Midterm",
  type: "exam",
  due_date: "2026-10-20",
  due_time: "18:30",
  weight_percent: 25,
  notes: null,
  recurrence: null,
  confidence: "high",
  ambiguity_reason: null,
};

describe("ParseResultSchema", () => {
  it("accepts a minimal valid result", () => {
    const r = ParseResultSchema.safeParse({
      course: validCourse,
      deliverables: [oneOffExam],
    });
    expect(r.success).toBe(true);
  });

  it("accepts a course with null code and instructor", () => {
    const r = ParseResultSchema.safeParse({
      course: { ...validCourse, code: null, instructor: null },
      deliverables: [],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an impossible calendar date", () => {
    const r = ParseResultSchema.safeParse({
      course: { ...validCourse, semester_start: "2026-13-45" },
      deliverables: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("DeliverableSchema — confidence / ambiguity invariant", () => {
  it("requires ambiguity_reason when confidence is not high", () => {
    const r = DeliverableSchema.safeParse({
      ...oneOffExam,
      confidence: "medium",
      ambiguity_reason: null,
    });
    expect(r.success).toBe(false);
  });

  it("accepts a non-high deliverable that explains its ambiguity", () => {
    const r = DeliverableSchema.safeParse({
      ...oneOffExam,
      confidence: "low",
      ambiguity_reason: "due date inferred from 'end of term'",
    });
    expect(r.success).toBe(true);
  });

  it("treats a blank ambiguity_reason as missing", () => {
    const r = DeliverableSchema.safeParse({
      ...oneOffExam,
      confidence: "low",
      ambiguity_reason: "   ",
    });
    expect(r.success).toBe(false);
  });
});

describe("DeliverableSchema — dateless and recurrence rules", () => {
  it("accepts a dateless item (participation)", () => {
    const r = DeliverableSchema.safeParse({
      ...oneOffExam,
      title: "Participation",
      type: "participation",
      due_date: null,
      due_time: null,
      weight_percent: 10,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a deliverable carrying both a recurrence and a due_date", () => {
    const r = DeliverableSchema.safeParse({
      ...oneOffExam,
      title: "Weekly quiz",
      type: "quiz",
      due_date: "2026-09-14",
      recurrence: {
        unit: "week",
        interval: 1,
        days_of_week: ["monday"],
        start_date: "2026-09-14",
        end_date: "2026-11-30",
        count: null,
      },
    });
    expect(r.success).toBe(false);
  });

  it("accepts a recurring quiz with a null due_date", () => {
    const r = DeliverableSchema.safeParse({
      ...oneOffExam,
      title: "Weekly quiz",
      type: "quiz",
      due_date: null,
      due_time: "23:59",
      weight_percent: 20,
      recurrence: {
        unit: "week",
        interval: 1,
        days_of_week: ["monday"],
        start_date: "2026-09-14",
        end_date: "2026-11-30",
        count: null,
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects weight_percent over 100", () => {
    const r = DeliverableSchema.safeParse({
      ...oneOffExam,
      weight_percent: 120,
    });
    expect(r.success).toBe(false);
  });
});

describe("RecurrenceSchema", () => {
  const base = {
    unit: "week",
    interval: 2,
    days_of_week: ["monday", "thursday"],
    start_date: "2026-09-08",
    end_date: null,
    count: null,
  };

  it("requires end_date or count to bound the series", () => {
    expect(RecurrenceSchema.safeParse(base).success).toBe(false);
    expect(RecurrenceSchema.safeParse({ ...base, count: 10 }).success).toBe(
      true,
    );
    expect(
      RecurrenceSchema.safeParse({ ...base, end_date: "2026-12-01" }).success,
    ).toBe(true);
  });

  it("rejects an empty days_of_week array but allows null", () => {
    expect(
      RecurrenceSchema.safeParse({ ...base, days_of_week: [], count: 5 })
        .success,
    ).toBe(false);
    expect(
      RecurrenceSchema.safeParse({ ...base, days_of_week: null, count: 5 })
        .success,
    ).toBe(true);
  });

  it("rejects an interval below 1", () => {
    expect(
      RecurrenceSchema.safeParse({ ...base, interval: 0, count: 5 }).success,
    ).toBe(false);
  });
});
