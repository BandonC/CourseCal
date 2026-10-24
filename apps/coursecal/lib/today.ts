// Calendar-day helpers for "what's due soon" views. Dates are ISO YYYY-MM-DD
// strings; arithmetic runs at UTC midnight so server time and DST never leak in.

/** Today's date in the given IANA timezone (en-CA formats as YYYY-MM-DD). */
export function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

export function addDays(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** e.g. "Thu, Oct 29". */
export function formatDay(iso: string): string {
  return DAY_FORMAT.format(new Date(`${iso}T00:00:00Z`));
}

/** "Today", "Tomorrow", or e.g. "Thu, Oct 29", relative to `today`. */
export function dayLabel(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  return formatDay(iso);
}
