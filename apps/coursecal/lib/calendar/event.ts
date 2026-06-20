import type { calendar_v3 } from "googleapis";
import type { Confidence } from "@coursecal/syllabus-parser";

// Pure deliverable-row → Calendar event builder. Mirrors the .ics output
// (lib/ics/build.ts): "CODE · Title", a 30-minute timed event when due_time is
// known, otherwise an all-day event. Local wall-clock times are tagged with the
// user's timezone (never shifted to UTC — a deadline is in the student's own
// time, per the .ics rationale and the CLAUDE.md "explicit timezone" rule).

export type CalendarEventInput = {
  courseLabel: string; // course code, or name when there's no code
  title: string;
  dueDate: string; // YYYY-MM-DD (caller guarantees non-null)
  dueTime: string | null; // HH:MM or HH:MM:SS
  weightPercent: string | null;
  notes: string | null;
  confidence: Confidence;
  ambiguityReason: string | null;
  timezone: string;
};

const TIMED_DURATION_MINUTES = 30;

function describe(input: CalendarEventInput): string {
  const lines: string[] = [];
  if (input.weightPercent != null) lines.push(`Weight: ${input.weightPercent}%`);
  if (input.notes) lines.push(input.notes);
  if (input.confidence !== "high" && input.ambiguityReason) {
    lines.push(`Flagged (${input.confidence}): ${input.ambiguityReason}`);
  }
  return lines.join("\n");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDateOnly(utcMs: number): string {
  const dt = new Date(utcMs);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function localDateTime(utcMs: number): string {
  const dt = new Date(utcMs);
  return (
    `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}` +
    `T${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:${pad(dt.getUTCSeconds())}`
  );
}

export function buildCalendarEvent(input: CalendarEventInput): calendar_v3.Schema$Event {
  const base: calendar_v3.Schema$Event = {
    summary: `${input.courseLabel} · ${input.title}`,
    description: describe(input),
    reminders: { useDefault: true },
  };

  const [y = 0, m = 0, d = 0] = input.dueDate.split("-").map(Number);

  if (input.dueTime) {
    const [h = 0, min = 0, s = 0] = input.dueTime.split(":").map(Number);
    // UTC math only drives the +30min rollover; the components are emitted as
    // local wall-clock and interpreted by Google in the supplied timeZone.
    const startMs = Date.UTC(y, m - 1, d, h, min, s);
    const endMs = startMs + TIMED_DURATION_MINUTES * 60_000;
    return {
      ...base,
      start: { dateTime: localDateTime(startMs), timeZone: input.timezone },
      end: { dateTime: localDateTime(endMs), timeZone: input.timezone },
    };
  }

  // All-day: end is the exclusive next day (Google's all-day convention).
  return {
    ...base,
    start: { date: input.dueDate },
    end: { date: isoDateOnly(Date.UTC(y, m - 1, d + 1)) },
  };
}
