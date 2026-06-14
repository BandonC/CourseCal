import { describe, expect, it } from "vitest";
import type { Deliverable, ParseResult } from "@coursecal/syllabus-parser";
import { buildIcs, icsFilename } from "./build";

const deliverable = (over: Partial<Deliverable>): Deliverable => ({
  title: "Item",
  type: "assignment",
  due_date: null,
  due_time: null,
  weight_percent: null,
  notes: null,
  recurrence: null,
  confidence: "high",
  ambiguity_reason: null,
  ...over,
});

const result = (deliverables: Deliverable[]): ParseResult => ({
  course: {
    name: "Algorithms",
    code: "CS 340",
    instructor: null,
    semester_start: "2026-09-01",
    semester_end: "2026-12-15",
  },
  deliverables,
});

const countVevents = (ics: string) => ics.match(/BEGIN:VEVENT/g)?.length ?? 0;

describe("buildIcs", () => {
  it("emits one VEVENT per dated deliverable and skips dateless items", () => {
    const built = buildIcs(
      result([
        deliverable({ title: "A1", due_date: "2026-09-15" }),
        deliverable({ title: "Participation", type: "participation" }), // dateless
      ]),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(countVevents(built.value)).toBe(1);
    expect(built.value).toContain("SUMMARY:CS 340 · A1");
    expect(built.value).not.toContain("Participation");
  });

  it("expands a recurrence to individual VEVENTs with no RRULE", () => {
    const built = buildIcs(
      result([
        deliverable({
          title: "Quiz",
          type: "quiz",
          recurrence: {
            unit: "week",
            interval: 1,
            days_of_week: ["friday"],
            start_date: "2026-09-11",
            end_date: "2026-10-02",
            count: null,
          },
        }),
      ]),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(countVevents(built.value)).toBe(4); // 4 Fridays 09-11..10-02
    expect(built.value).not.toContain("RRULE");
  });

  it("uses floating local time for timed deadlines (no UTC Z)", () => {
    const built = buildIcs(
      result([deliverable({ due_date: "2026-09-15", due_time: "23:59" })]),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value).toMatch(/DTSTART:20260915T235900(\r?\n)/);
    expect(built.value).not.toMatch(/DTSTART:\d+T\d+Z/);
  });

  it("renders date-only deliverables as all-day events", () => {
    const built = buildIcs(result([deliverable({ due_date: "2026-09-15" })]));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value).toContain("DTSTART;VALUE=DATE:20260915");
    expect(built.value).toContain("DTEND;VALUE=DATE:20260916");
    expect(built.value).not.toContain("P1DT");
  });

  it("splits a recurring item's series weight across occurrences", () => {
    const built = buildIcs(
      result([
        deliverable({
          weight_percent: 12,
          recurrence: {
            unit: "week",
            interval: 1,
            days_of_week: ["friday"],
            start_date: "2026-09-11",
            end_date: null,
            count: 12,
          },
        }),
      ]),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value).toContain("Weight: 1%");
  });

  it("fails when there is nothing dated to export", () => {
    const built = buildIcs(result([deliverable({ type: "participation" })]));
    expect(built.ok).toBe(false);
  });
});

describe("icsFilename", () => {
  it("slugifies the course code", () => {
    expect(icsFilename(result([]).course)).toBe("cs-340.ics");
  });

  it("falls back to the course name when there is no code", () => {
    const course = { ...result([]).course, code: null };
    expect(icsFilename(course)).toBe("algorithms.ics");
  });
});
