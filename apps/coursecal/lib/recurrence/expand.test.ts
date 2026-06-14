import { describe, expect, it } from "vitest";
import type { Recurrence } from "@coursecal/syllabus-parser";
import { expandRecurrence } from "./expand";

// 2026-09-11 is a Friday; 2026-09-07 is a Monday (used as fixed anchors below).
const weekly = (over: Partial<Recurrence>): Recurrence => ({
  unit: "week",
  interval: 1,
  days_of_week: ["friday"],
  start_date: "2026-09-11",
  end_date: "2026-12-04",
  count: null,
  ...over,
});

describe("expandRecurrence — weekly", () => {
  it("expands every Friday across the term, bounded by end_date", () => {
    const dates = expandRecurrence(weekly({}));
    expect(dates).toHaveLength(13);
    expect(dates[0]).toBe("2026-09-11");
    expect(dates.at(-1)).toBe("2026-12-04");
    // every step is 7 days apart
    expect(dates).toContain("2026-09-18");
    expect(dates).toContain("2026-10-02");
  });

  it("honors interval (biweekly) and a count terminator", () => {
    const dates = expandRecurrence(weekly({ interval: 2, end_date: null, count: 4 }));
    expect(dates).toEqual(["2026-09-11", "2026-09-25", "2026-10-09", "2026-10-23"]);
  });

  it("count bounds the series even when end_date is far off", () => {
    expect(expandRecurrence(weekly({ count: 3 }))).toEqual([
      "2026-09-11",
      "2026-09-18",
      "2026-09-25",
    ]);
  });

  it("anchors on the start date's weekday when days_of_week is null", () => {
    const dates = expandRecurrence(
      weekly({ days_of_week: null, end_date: "2026-09-25" }),
    );
    expect(dates).toEqual(["2026-09-11", "2026-09-18", "2026-09-25"]);
  });

  it("merges and sorts multiple weekdays", () => {
    const dates = expandRecurrence(
      weekly({
        days_of_week: ["monday", "wednesday"],
        start_date: "2026-09-07",
        end_date: "2026-09-16",
      }),
    );
    expect(dates).toEqual(["2026-09-07", "2026-09-09", "2026-09-14", "2026-09-16"]);
  });

  it("keeps every occurrence within the semester bounds", () => {
    const dates = expandRecurrence(weekly({}));
    for (const d of dates) {
      expect(d >= "2026-09-11").toBe(true);
      expect(d <= "2026-12-04").toBe(true);
    }
  });
});

describe("expandRecurrence — monthly", () => {
  it("clamps the day to each month's length", () => {
    const dates = expandRecurrence({
      unit: "month",
      interval: 1,
      days_of_week: null,
      start_date: "2026-01-31",
      end_date: null,
      count: 3,
    });
    expect(dates).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
});
