import { describe, expect, it } from "vitest";
import { buildCalendarEvent, type CalendarEventInput } from "./event";

const baseInput: CalendarEventInput = {
  courseLabel: "HIST 1812G",
  title: "Weekly quiz",
  dueDate: "2026-09-07",
  dueTime: null,
  weightPercent: "3.00",
  notes: null,
  confidence: "high",
  ambiguityReason: null,
  timezone: "America/Toronto",
};

describe("buildCalendarEvent", () => {
  it("builds a 30-minute timed event tagged with the user's timezone", () => {
    const e = buildCalendarEvent({ ...baseInput, dueTime: "23:59" });
    expect(e.summary).toBe("HIST 1812G · Weekly quiz");
    expect(e.start).toEqual({ dateTime: "2026-09-07T23:59:00", timeZone: "America/Toronto" });
    // +30 minutes rolls past midnight to the next day.
    expect(e.end).toEqual({ dateTime: "2026-09-08T00:29:00", timeZone: "America/Toronto" });
    expect(e.reminders).toEqual({ useDefault: true });
  });

  it("builds an all-day event with an exclusive next-day end and no timezone", () => {
    const e = buildCalendarEvent(baseInput);
    expect(e.start).toEqual({ date: "2026-09-07" });
    expect(e.end).toEqual({ date: "2026-09-08" });
  });

  it("composes the description from weight, notes, and low-confidence flag", () => {
    const e = buildCalendarEvent({
      ...baseInput,
      notes: "Open book",
      confidence: "low",
      ambiguityReason: "no date given",
    });
    expect(e.description).toBe("Weight: 3.00%\nOpen book\nFlagged (low): no date given");
  });
});
