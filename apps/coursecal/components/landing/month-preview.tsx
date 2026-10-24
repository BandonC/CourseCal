// Static, presentational month calendar for the login screen — deadlines as
// solid course-colored blocks, with one hell week tinted. Not wired to any data;
// like TimelinePreview, it uses the real tokens so it reads as the product.
// Course blocks use --chart-1/2/5 because primary-foreground text stays legible
// on those in both themes.
const COURSES = {
  cs: { label: "CS 247", className: "bg-chart-1" },
  math: { label: "MATH 237", className: "bg-chart-2" },
  phil: { label: "PHIL 256", className: "bg-chart-5" },
} as const;

type CourseKey = keyof typeof COURSES;

const EVENTS: Record<number, { course: CourseKey; title: string }[]> = {
  2: [{ course: "math", title: "Quiz 3" }],
  7: [{ course: "cs", title: "Lab 4" }],
  9: [{ course: "phil", title: "Response 2" }],
  14: [{ course: "cs", title: "A2" }],
  16: [{ course: "math", title: "Quiz 4" }],
  20: [{ course: "cs", title: "A3" }],
  21: [{ course: "math", title: "Midterm" }],
  22: [{ course: "phil", title: "Essay 1" }],
  23: [{ course: "cs", title: "Midterm" }],
  28: [{ course: "cs", title: "Lab 6" }],
  30: [{ course: "phil", title: "Response 4" }],
};

// October 2026 on a Monday-first grid: Oct 1 is a Thursday, so the first row
// opens with Sep 28–30 and the last closes with Nov 1 (0 / 32+ = outside month).
const WEEKS: number[][] = [
  [-28, -29, -30, 1, 2, 3, 4],
  [5, 6, 7, 8, 9, 10, 11],
  [12, 13, 14, 15, 16, 17, 18],
  [19, 20, 21, 22, 23, 24, 25],
  [26, 27, 28, 29, 30, 31, -1],
];
const HELL_WEEK = 3;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthPreview() {
  return (
    <div aria-hidden className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-md">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold tracking-tight">October</h2>
        <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {Object.values(COURSES).map((c) => (
            <li key={c.label} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-sm ${c.className}`} />
              {c.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="mt-1 flex flex-1 flex-col gap-1">
        {WEEKS.map((week, wi) => (
          <div
            key={wi}
            className={`relative grid flex-1 grid-cols-7 gap-1 rounded-lg ${wi === HELL_WEEK ? "bg-destructive/10 ring-1 ring-destructive/30" : ""}`}
          >
            {wi === HELL_WEEK ? (
              <span className="absolute -top-2 right-2 rounded bg-destructive px-1.5 text-[10px] font-medium text-white">
                Hell week
              </span>
            ) : null}
            {week.map((day) => (
              <div key={day} className="flex min-h-14 flex-col gap-1 rounded-md p-1">
                <span className={`text-xs ${day < 0 ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
                  {Math.abs(day)}
                </span>
                {(EVENTS[day] ?? []).map((e) => (
                  <span
                    key={e.title}
                    className={`truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-primary-foreground ${COURSES[e.course].className}`}
                  >
                    {e.title}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
