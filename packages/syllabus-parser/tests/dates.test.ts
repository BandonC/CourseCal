import { describe, it, expect } from "vitest";
import { resolveRelativeDate } from "../src/dates";

// 2026-09-07 is a Monday, which keeps the Monday-grid fixtures readable.
const ctx = { semesterStart: "2026-09-07", semesterEnd: "2026-12-07" };

function expectDate(
  r: ReturnType<typeof resolveRelativeDate>,
  iso: string,
): void {
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.data).toBe(iso);
}

describe("resolveRelativeDate — Week N", () => {
  it("Week 1 is the semester start", () => {
    expectDate(resolveRelativeDate("Week 1", ctx), "2026-09-07");
  });

  it("Week 3 is two weeks after start", () => {
    expectDate(resolveRelativeDate("Week 3", ctx), "2026-09-21");
  });

  it("is case- and whitespace-insensitive", () => {
    expectDate(resolveRelativeDate("  week  3 ", ctx), "2026-09-21");
  });
});

describe("resolveRelativeDate — weekday of Week N", () => {
  it("Monday of Week 1", () => {
    expectDate(resolveRelativeDate("Monday of Week 1", ctx), "2026-09-07");
  });

  it("Friday of Week 1", () => {
    expectDate(resolveRelativeDate("Friday of Week 1", ctx), "2026-09-11");
  });

  it("accepts the reversed order: Week 2 Monday", () => {
    expectDate(resolveRelativeDate("Week 2 Monday", ctx), "2026-09-14");
  });

  it("Wednesday of Week 3", () => {
    expectDate(resolveRelativeDate("Wednesday of Week 3", ctx), "2026-09-23");
  });
});

describe("resolveRelativeDate — after reading week", () => {
  const reading = {
    ...ctx,
    readingWeeks: [{ start: "2026-10-12", end: "2026-10-16" }],
  };

  it("resolves to the first matching weekday after the break", () => {
    expectDate(
      resolveRelativeDate("Monday after reading week", reading),
      "2026-10-19",
    );
  });

  it("is ambiguous when no reading-week range is supplied", () => {
    const r = resolveRelativeDate("Monday after reading week", ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("ambiguous");
  });

  it("is ambiguous when multiple reading-week ranges are supplied", () => {
    const r = resolveRelativeDate("Monday after the break", {
      ...ctx,
      readingWeeks: [
        { start: "2026-10-12", end: "2026-10-16" },
        { start: "2026-11-09", end: "2026-11-13" },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("ambiguous");
  });
});

describe("resolveRelativeDate — landing checks", () => {
  it("flags a date that lands on a holiday, but hands back the date", () => {
    const r = resolveRelativeDate("Week 1", {
      ...ctx,
      holidays: ["2026-09-07"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "ambiguous")
      expect(r.error.date).toBe("2026-09-07");
  });

  it("flags a date that lands inside a reading week", () => {
    const r = resolveRelativeDate("Week 6", {
      ...ctx,
      readingWeeks: [{ start: "2026-10-12", end: "2026-10-16" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "ambiguous")
      expect(r.error.date).toBe("2026-10-12");
  });
});

describe("resolveRelativeDate — absolute passthrough and errors", () => {
  it("passes an in-bounds absolute ISO date through unchanged", () => {
    expectDate(resolveRelativeDate("2026-10-20", ctx), "2026-10-20");
  });

  it("rejects a date outside the semester", () => {
    const r = resolveRelativeDate("Week 40", ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("out_of_bounds");
  });

  it("rejects an unrecognized expression", () => {
    const r = resolveRelativeDate("sometime next month", ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("unrecognized_expression");
  });
});
