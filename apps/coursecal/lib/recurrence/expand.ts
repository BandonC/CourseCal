import type { DayOfWeek, Recurrence } from "@coursecal/syllabus-parser";

// Pure expansion of a recurrence descriptor into its occurrence dates (ISO
// YYYY-MM-DD). The library returns a descriptor; the app expands it (§7.1) —
// Phase 2 emits one VEVENT per occurrence, Phase 3 reuses this for one DB row
// per occurrence. Deterministic: same descriptor → same dates, no ambient time.

const DAY_INDEX: Record<DayOfWeek, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const MS_PER_DAY = 86_400_000;
// Safety bounds so a far-future / count-only series can't loop unbounded.
const MAX_PER_WEEKDAY = 520; // ~10 years of weeks
const MAX_MONTHS = 120;

function toUTC(iso: string): number {
  const [y = 0, m = 0, d = 0] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function toISO(ms: number): string {
  const dt = new Date(ms);
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${m}-${d}`;
}

export function expandRecurrence(recurrence: Recurrence): string[] {
  return recurrence.unit === "week" ? expandWeekly(recurrence) : expandMonthly(recurrence);
}

function expandWeekly(r: Recurrence): string[] {
  const start = toUTC(r.start_date);
  const end = r.end_date ? toUTC(r.end_date) : Infinity;
  const stepMs = r.interval * 7 * MS_PER_DAY;
  const startWeekday = new Date(start).getUTCDay();

  // days_of_week null = no weekday pinned: anchor on the start date's weekday.
  const targets = r.days_of_week
    ? r.days_of_week.map((d) => DAY_INDEX[d])
    : [startWeekday];

  const occurrences = new Set<number>();
  for (const weekday of targets) {
    // First occurrence on/after start with this weekday, then step by interval weeks.
    const delta = (((weekday - startWeekday) % 7) + 7) % 7;
    let cur = start + delta * MS_PER_DAY;
    for (let i = 0; i < MAX_PER_WEEKDAY && cur <= end; i++) {
      occurrences.add(cur);
      cur += stepMs;
    }
  }

  const sorted = [...occurrences].sort((a, b) => a - b);
  const bounded = r.count != null ? sorted.slice(0, r.count) : sorted;
  return bounded.map(toISO);
}

function expandMonthly(r: Recurrence): string[] {
  const [y = 0, m = 0, day = 0] = r.start_date.split("-").map(Number);
  const end = r.end_date ? toUTC(r.end_date) : Infinity;

  const occurrences: number[] = [];
  for (let i = 0; i < MAX_MONTHS; i++) {
    const monthIndex = m - 1 + i * r.interval;
    // Clamp the day to the target month's length (e.g. Jan 31 → Feb 28).
    const lastDay = new Date(Date.UTC(y, monthIndex + 1, 0)).getUTCDate();
    const ms = Date.UTC(y, monthIndex, Math.min(day, lastDay));
    if (ms > end) break;
    occurrences.push(ms);
    if (r.count != null && occurrences.length >= r.count) break;
  }
  return occurrences.map(toISO);
}
