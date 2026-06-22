import { createEvents, type DateArray, type EventAttributes } from "ics";
import type { Course, Deliverable, ParseResult } from "@coursecal/syllabus-parser";
import { expandRecurrence } from "@/lib/recurrence/expand";

// Build an .ics calendar from a ParseResult. One VEVENT per dated deliverable;
// recurring items are expanded to N VEVENTs (matches §7.1 and how Phase 3's
// Google Calendar export creates individual events). Dateless items skip export
// (§7.1). Times are floating-local — a syllabus deadline is in the student's own
// time, not a fixed UTC instant.

type BuildResult = { ok: true; value: string } | { ok: false; error: string };

function coursePrefix(course: Course): string {
  return course.code ?? course.name;
}

function descriptionFor(d: Deliverable, weight: number | null): string {
  const lines: string[] = [];
  if (weight != null) lines.push(`Weight: ${weight}%`);
  if (d.notes) lines.push(d.notes);
  if (d.confidence !== "high" && d.ambiguity_reason) {
    lines.push(`Flagged (${d.confidence}): ${d.ambiguity_reason}`);
  }
  return lines.join("\n");
}

function makeEvent(
  course: Course,
  d: Deliverable,
  isoDate: string,
  weight: number | null,
): EventAttributes {
  const [y = 0, m = 0, day = 0] = isoDate.split("-").map(Number);
  const base = {
    title: `${coursePrefix(course)} · ${d.title}`,
    description: descriptionFor(d, weight),
    busyStatus: "BUSY" as const,
  };

  if (d.due_time) {
    const [h = 0, min = 0] = d.due_time.split(":").map(Number);
    const start: DateArray = [y, m, day, h, min];
    // Floating local time: a syllabus deadline is in the student's own time, so
    // it must not be shifted to UTC (which would also vary by deploy server TZ).
    return {
      ...base,
      start,
      startInputType: "local",
      startOutputType: "local",
      duration: { minutes: 30 },
    };
  }

  // All-day (date only): end is the next day, yielding a clean DTEND;VALUE=DATE
  // rather than the malformed P1DT a {days:1} duration produces.
  const start: DateArray = [y, m, day];
  const next = new Date(Date.UTC(y, m - 1, day + 1));
  const end: DateArray = [next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()];
  return { ...base, start, end };
}

// One course's dated deliverables as VEVENT attributes (recurring items expanded).
function eventsFor(result: ParseResult): EventAttributes[] {
  const events: EventAttributes[] = [];
  for (const d of result.deliverables) {
    if (d.recurrence) {
      const dates = expandRecurrence(d.recurrence);
      // The descriptor's weight is the series total; split it across occurrences (§7.1).
      const perInstance =
        d.weight_percent != null && dates.length > 0
          ? Math.round((d.weight_percent / dates.length) * 100) / 100
          : null;
      for (const date of dates) events.push(makeEvent(result.course, d, date, perInstance));
    } else if (d.due_date) {
      events.push(makeEvent(result.course, d, d.due_date, d.weight_percent));
    }
    // No recurrence and no due_date → dateless item, skipped (§7.1).
  }
  return events;
}

function emitCalendar(events: EventAttributes[], calName: string): BuildResult {
  if (events.length === 0) {
    return { ok: false, error: "No dated deliverables to export." };
  }
  const { error, value } = createEvents(events, { productId: "coursecal/ics", calName });
  if (error || !value) {
    return { ok: false, error: "Couldn't build the calendar file." };
  }
  return { ok: true, value };
}

export function buildIcs(result: ParseResult): BuildResult {
  return emitCalendar(eventsFor(result), coursePrefix(result.course));
}

// Combined calendar for a whole semester: every course's dated deliverables in one
// .ics, so the non-Google fallback covers the multi-syllabus flow in one download.
export function buildIcsForCourses(results: ParseResult[], calName: string): BuildResult {
  return emitCalendar(results.flatMap(eventsFor), calName);
}

export function icsFilename(course: Course): string {
  const slug = coursePrefix(course)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "syllabus"}.ics`;
}
