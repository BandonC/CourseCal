import { WORKLOAD_DEFAULTS, heavyWeekThreshold } from "./constants";
import type { ConflictDeliverable, SemesterBounds, WeekDensity } from "./types";

// Layer 1 (density). Pure, no ambient time: dates are parsed as UTC calendar days
// so bucketing is timezone-independent (the deliverable's dueDate is already the
// resolved local calendar date — see DECISIONS 2026-06-13 on the ISO seam).

const MS_PER_DAY = 86_400_000;

/** Parse an ISO YYYY-MM-DD as a UTC epoch (calendar-day arithmetic, no tz drift). */
export function toUTC(iso: string): number {
  const [y = 0, m = 0, d = 0] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function toISO(ms: number): string {
  const dt = new Date(ms);
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${m}-${d}`;
}

/** Workload contribution of one deliverable: its grade weight when known, else the
 * type-based default (§12.4). */
export function workloadScore(d: ConflictDeliverable): number {
  return d.weightPercent ?? WORKLOAD_DEFAULTS[d.type];
}

/** Bucket deliverables into consecutive 7-day weeks from the semester start, score
 * each, and flag weeks at/above heavyWeekThreshold. Out-of-range dates clamp to the
 * first/last week (valid data won't hit this — it's a guard, not a feature). */
export function weekDensities(
  deliverables: ConflictDeliverable[],
  semester: SemesterBounds,
): WeekDensity[] {
  const start = toUTC(semester.start);
  const end = toUTC(semester.end);
  const totalDays = Math.floor((end - start) / MS_PER_DAY) + 1;
  const weekCount = Math.max(1, Math.ceil(totalDays / 7));

  const weeks: WeekDensity[] = Array.from({ length: weekCount }, (_, i) => {
    const wStart = start + i * 7 * MS_PER_DAY;
    const wEnd = Math.min(wStart + 6 * MS_PER_DAY, end);
    return {
      index: i + 1,
      start: toISO(wStart),
      end: toISO(wEnd),
      workload: 0,
      count: 0,
      heavy: false,
    };
  });

  for (const d of deliverables) {
    const offsetDays = Math.floor((toUTC(d.dueDate) - start) / MS_PER_DAY);
    const idx = Math.min(weekCount - 1, Math.max(0, Math.floor(offsetDays / 7)));
    const week = weeks[idx]!;
    week.workload += workloadScore(d);
    week.count += 1;
  }

  for (const w of weeks) w.heavy = w.workload >= heavyWeekThreshold;
  return weeks;
}
