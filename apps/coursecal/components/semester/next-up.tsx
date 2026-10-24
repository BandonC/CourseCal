import Link from "next/link";
import type { SemesterTimelineData } from "@/lib/db/queries/semesters";

// "Next up" strip above the semester timeline: every dated deliverable due from
// today through the next 6 days (a rolling 7-day window), across all courses.
// Server component. `today` is an ISO date already resolved in the user's
// timezone by the page; all date math here is on ISO strings at UTC midnight,
// so no ambient server time leaks in. Hidden outside the semester's dates.
const WINDOW_DAYS = 7;

function addDays(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function dayLabel(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  return DAY_FORMAT.format(new Date(`${iso}T00:00:00Z`));
}

export function NextUp({
  data,
  today,
  currentWeek,
}: {
  data: SemesterTimelineData;
  today: string;
  currentWeek: number | null;
}) {
  if (today < data.startDate || today > data.endDate) return null;

  const courseById = new Map(data.courses.map((c) => [c.id, c]));
  const windowEnd = addDays(today, WINDOW_DAYS - 1);
  const upcoming = data.courses
    .flatMap((c) => c.deliverables)
    .filter((d): d is typeof d & { dueDate: string } => d.dueDate !== null && d.dueDate >= today)
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? "").localeCompare(b.dueTime ?? ""),
    );
  const inWindow = upcoming.filter((d) => d.dueDate <= windowEnd);
  const shown = inWindow.length > 0 ? inWindow : upcoming.slice(0, 1);

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium">Next up</h2>
        {currentWeek !== null ? (
          <a
            href={`#week-${currentWeek}`}
            className="text-sm text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          >
            Jump to this week
          </a>
        ) : null}
      </div>

      {inWindow.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Nothing due in the next 7 days.{shown.length > 0 ? " After that:" : ""}
        </p>
      ) : null}

      {shown.length > 0 ? (
        <ul className="mt-2 divide-y divide-border">
          {shown.map((d) => {
            const c = courseById.get(d.courseId)!;
            return (
              <li key={d.id}>
                <Link
                  href={`/course/${d.courseId}`}
                  className="flex items-center gap-3 py-2 text-sm hover:bg-muted/40"
                >
                  <span className="w-24 shrink-0 text-muted-foreground">
                    {dayLabel(d.dueDate, today)}
                  </span>
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{d.title}</span>{" "}
                    <span className="text-muted-foreground">· {c.code ?? c.name}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {d.dueTime ? d.dueTime.slice(0, 5) : ""}
                    {d.dueTime && d.weightPercent ? " · " : ""}
                    {d.weightPercent ? `${Number(d.weightPercent)}%` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
