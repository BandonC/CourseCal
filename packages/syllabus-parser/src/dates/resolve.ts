// Pure relative-date resolution (COURSECAL.md §8.4, §12.3). No Date.now(), no
// date library, no timezone — date-only resolution is timezone-independent, and
// all arithmetic runs on UTC-midnight instants so DST never enters the picture.
// The library never knows a school's calendar; reading weeks / holidays are
// passed in (see CLAUDE.md on purity).

import { type Result, ok, err } from "../result";

export type IsoDate = string; // "YYYY-MM-DD"
export type DateRange = { start: IsoDate; end: IsoDate };

export type DateResolutionContext = {
  semesterStart: IsoDate;
  semesterEnd: IsoDate;
  readingWeeks?: DateRange[];
  holidays?: IsoDate[];
};

export type DateResolutionError =
  | { kind: "unrecognized_expression"; message: string }
  | { kind: "out_of_bounds"; message: string }
  | { kind: "ambiguous"; message: string; date?: IsoDate };

const MS_PER_DAY = 86_400_000;

// 0 = Sunday … 6 = Saturday (matches Date#getUTCDay).
const DOW: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function isoToUtc(iso: IsoDate): number {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return Date.UTC(y, m - 1, d);
}

function utcToIso(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

const addDays = (ms: number, n: number): number => ms + n * MS_PER_DAY;
const utcDow = (ms: number): number => new Date(ms).getUTCDay();

/** True only for a real calendar date in YYYY-MM-DD form (roundtrip rejects 2026-13-45). */
function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && utcToIso(isoToUtc(s)) === s;
}

/** Monday of the ISO week containing `ms`. */
function mondayOfWeek(ms: number): number {
  const sinceMonday = (utcDow(ms) + 6) % 7; // Mon→0 … Sun→6
  return addDays(ms, -sinceMonday);
}

const offsetFromMonday = (dow: number): number => (dow + 6) % 7;

const inRange = (ms: number, start: IsoDate, end: IsoDate): boolean =>
  ms >= isoToUtc(start) && ms <= isoToUtc(end);

const RE_AFTER_BREAK =
  /^(\w+)\s+after\s+(?:the\s+)?(?:reading\s+week|spring\s+break|break)$/;
const RE_DAY_OF_WEEK = /^(\w+)\s+(?:of\s+)?week\s+(\d+)$/;
const RE_WEEK_OF_DAY = /^week\s+(\d+)\s+(\w+)$/;
const RE_WEEK = /^week\s+(\d+)$/;

/**
 * Resolve a relative date expression against semester boundaries. Supported
 * forms (v1): an absolute ISO date (passthrough), `Week N`,
 * `<Weekday> of Week N` / `Week N <Weekday>`, and `<Weekday> after reading week`.
 */
export function resolveRelativeDate(
  expression: string,
  ctx: DateResolutionContext,
): Result<IsoDate, DateResolutionError> {
  const expr = expression
    .trim()
    .toLowerCase()
    .replace(/[.,;:]+$/, "")
    .replace(/\s+/g, " ");
  const startMs = isoToUtc(ctx.semesterStart);

  // form 0 — absolute date passthrough (idempotency property, §12.3)
  if (isIsoDate(expr)) return finalize(isoToUtc(expr), ctx);

  // form 3 — <weekday> after reading week / break
  const ab = RE_AFTER_BREAK.exec(expr);
  if (ab) {
    const dow = ab[1] ? DOW[ab[1]] : undefined;
    if (dow === undefined) return unrecognized(expression);
    const ranges = ctx.readingWeeks ?? [];
    if (ranges.length !== 1) {
      return err({
        kind: "ambiguous",
        message:
          ranges.length === 0
            ? "no reading-week range supplied to resolve a break-relative date"
            : "multiple reading-week ranges supplied; cannot disambiguate the break",
      });
    }
    const afterMs = addDays(isoToUtc(ranges[0]!.end), 1);
    return finalize(addDays(afterMs, (dow - utcDow(afterMs) + 7) % 7), ctx);
  }

  // form 2 — weekday + week N, either order
  const dwn = RE_DAY_OF_WEEK.exec(expr);
  const wnd = dwn ? null : RE_WEEK_OF_DAY.exec(expr);
  if (dwn || wnd) {
    const dayToken = dwn ? dwn[1] : wnd![2];
    const weekStr = dwn ? dwn[2] : wnd![1];
    const dow = dayToken ? DOW[dayToken] : undefined;
    if (dow === undefined || !weekStr) return unrecognized(expression);
    const weekNMonday = addDays(
      mondayOfWeek(startMs),
      (Number(weekStr) - 1) * 7,
    );
    return finalize(addDays(weekNMonday, offsetFromMonday(dow)), ctx);
  }

  // form 1 — bare Week N
  const wk = RE_WEEK.exec(expr);
  if (wk?.[1]) return finalize(addDays(startMs, (Number(wk[1]) - 1) * 7), ctx);

  return unrecognized(expression);
}

function unrecognized(
  expression: string,
): Result<IsoDate, DateResolutionError> {
  return err({
    kind: "unrecognized_expression",
    message: `could not resolve date expression: "${expression.trim()}"`,
  });
}

function finalize(
  ms: number,
  ctx: DateResolutionContext,
): Result<IsoDate, DateResolutionError> {
  const iso = utcToIso(ms);
  if (!inRange(ms, ctx.semesterStart, ctx.semesterEnd)) {
    return err({
      kind: "out_of_bounds",
      message: `${iso} falls outside the semester`,
    });
  }
  for (const r of ctx.readingWeeks ?? []) {
    if (inRange(ms, r.start, r.end)) {
      return err({
        kind: "ambiguous",
        message: `${iso} falls within a reading week`,
        date: iso,
      });
    }
  }
  if ((ctx.holidays ?? []).includes(iso)) {
    return err({
      kind: "ambiguous",
      message: `${iso} is a holiday / no-class day`,
      date: iso,
    });
  }
  return ok(iso);
}
