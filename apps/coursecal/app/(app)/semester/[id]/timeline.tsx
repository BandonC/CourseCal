import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  WORKLOAD_DEFAULTS,
  heavyWeekThreshold,
  type Cluster,
  type ConflictReport,
} from "@/lib/conflict-detection";
import type { SemesterTimelineData } from "@/lib/db/queries/semesters";
import { formatDay } from "@/lib/today";

// Server component: deliverables on a vertical week axis (apps/coursecal/CLAUDE.md
// — CSS grid/flex, no charting libs). Hell weeks (Layer 1) tint the row and get a
// Heavy/Busy/Light label; each cluster (Layer 2) is one banner on the week it
// starts in. Course colors are the stored --chart-N vars, applied inline (the one
// sanctioned dynamic-style case — see lib/courses/colors). Weeks before the
// current one fold into a single <details> so the page opens on "now".

// Display-only cutoffs on the workload scale (grade-weight points). They change
// emphasis, not detection — the algorithm's knobs live in lib/conflict-detection.
const MAJOR_SCORE = 10; // ≥ this: bold title + weight pill (midterms, projects)
const MINOR_SCORE = 2; // < this: muted, smaller row (weekly labs, participation)
const BUSY_LOAD = 15; // weekly load ≥ this (and below heavyWeekThreshold): "Busy"

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function shortDate(iso: string): string {
  const [, m = 1, d = 1] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

type Course = SemesterTimelineData["courses"][number];
type Deliverable = Course["deliverables"][number] & { dueDate: string };
type Week = ConflictReport["weeks"][number] & { items: Deliverable[]; clusters: Cluster[] };

function courseLabel(c: Course): string {
  return c.code ?? c.name;
}

function score(d: Deliverable): number {
  return d.weightPercent !== null ? Number(d.weightPercent) : WORKLOAD_DEFAULTS[d.type];
}

function daysSpanned(c: Cluster): number {
  return Math.round((Date.parse(c.end) - Date.parse(c.start)) / 86_400_000) + 1;
}

export function SemesterTimeline({
  data,
  report,
  currentWeek,
}: {
  data: SemesterTimelineData;
  report: ConflictReport;
  currentWeek: number | null;
}) {
  const courseById = new Map(data.courses.map((c) => [c.id, c]));

  const dated = data.courses
    .flatMap((c) => c.deliverables)
    .filter((d): d is Deliverable => d.dueDate !== null)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const heavyCount = report.weeks.filter((w) => w.heavy).length;
  const crossCourseClusters = report.clusters.filter((c) => c.crossCourse).length;

  // Bucket deliverables (and each cluster, by its start date) into their week.
  // The weeks are contiguous and cover the term; small N, so nested scans are fine.
  const weeks: Week[] = report.weeks.map((w) => ({
    ...w,
    items: dated.filter((d) => d.dueDate >= w.start && d.dueDate <= w.end),
    clusters: report.clusters.filter((c) => c.start >= w.start && c.start <= w.end),
  }));

  if (dated.length === 0) {
    return (
      <p className="text-muted-foreground">
        No dated deliverables to plot. Dateless items (e.g. participation) don&apos;t
        appear on the timeline.
      </p>
    );
  }

  // Only fold the past while the semester is running; before it starts or after
  // it ends there's no "now" to open on, so every week shows.
  const past = currentWeek !== null ? weeks.filter((w) => w.index < currentWeek) : [];
  const upcoming = currentWeek !== null ? weeks.filter((w) => w.index >= currentWeek) : weeks;
  const pastItems = past.reduce((n, w) => n + w.items.length, 0);
  const pastHeavy = past.filter((w) => w.heavy).length;

  const renderWeek = (w: Week) => (
    <WeekCard key={w.index} week={w} isCurrent={w.index === currentWeek} courseById={courseById} />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {heavyCount > 0 ? (
          <Badge variant="destructive">
            {heavyCount} hell week{heavyCount > 1 ? "s" : ""}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">No hell weeks flagged</span>
        )}
        {report.clusters.length > 0 ? (
          <Badge variant="secondary">
            {report.clusters.length} deadline cluster{report.clusters.length > 1 ? "s" : ""}
            {crossCourseClusters > 0 ? ` · ${crossCourseClusters} cross-course` : ""}
          </Badge>
        ) : null}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {data.courses.map((c) => (
          <li key={c.id}>
            <Link
              href={`/course/${c.id}`}
              className="group flex items-center gap-1.5 text-primary"
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: c.color }}
                aria-hidden
              />
              <span className="underline decoration-primary/40 underline-offset-2 group-hover:decoration-primary">
                {courseLabel(c)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {past.length > 0 ? (
        <details className="group rounded-xl border border-border bg-card shadow-xs">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground">
            <span className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
            Weeks 1–{past.length} · {pastItems} item{pastItems === 1 ? "" : "s"}
            {pastHeavy > 0 ? ` · ${pastHeavy} hell week${pastHeavy > 1 ? "s" : ""}` : ""}
          </summary>
          <ol className="space-y-2 border-t border-border p-2">{past.map(renderWeek)}</ol>
        </details>
      ) : null}

      <ol className="space-y-2">{upcoming.map(renderWeek)}</ol>
    </div>
  );
}

function WeekCard({
  week: w,
  isCurrent,
  courseById,
}: {
  week: Week;
  isCurrent: boolean;
  courseById: Map<Course["id"], Course>;
}) {
  const load = w.heavy
    ? { label: "Heavy", className: "text-destructive", bar: "bg-destructive" }
    : w.workload >= BUSY_LOAD
      ? { label: "Busy", className: "text-warning", bar: "bg-warning" }
      : { label: "Light", className: "text-muted-foreground", bar: "bg-muted-foreground/40" };
  // Bar fills at 2× the hell-week threshold, so "Heavy" sits at the halfway mark.
  const fill = Math.min(100, Math.round((w.workload / (heavyWeekThreshold * 2)) * 100));

  return (
    <li
      id={`week-${w.index}`}
      className={`scroll-mt-20 rounded-xl border p-3 shadow-xs ${w.heavy ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"} ${isCurrent ? "ring-2 ring-primary/40" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">
          Week {w.index}{" "}
          {isCurrent ? (
            <Badge variant="secondary" className="mr-1">
              This week
            </Badge>
          ) : null}
          <span className="font-normal text-muted-foreground">
            · {shortDate(w.start)}–{shortDate(w.end)}
          </span>
        </h2>
        {w.items.length > 0 ? (
          <span
            className={`flex items-center gap-2 text-xs font-medium ${load.className}`}
            title={`Workload ${Math.round(w.workload)} (grade-weight points; ${heavyWeekThreshold}+ is a hell week)`}
          >
            <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className={`block h-full rounded-full ${load.bar}`} style={{ width: `${fill}%` }} />
            </span>
            {load.label}
          </span>
        ) : null}
      </div>

      {w.clusters.map((c) => (
        <p
          key={c.start + c.deliverableIds.join()}
          className="mt-2 flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive"
        >
          <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden />
          {c.deliverableIds.length} deadlines in {daysSpanned(c)} day{daysSpanned(c) > 1 ? "s" : ""}
          {c.crossCourse ? ` across ${c.courseIds.length} courses` : ""}
        </p>
      ))}

      {w.items.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">Nothing due</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {w.items.map((d) => (
            <ItemRow key={d.id} d={d} course={courseById.get(d.courseId)!} />
          ))}
        </ul>
      )}
    </li>
  );
}

// One line per deliverable, emphasis by stakes: majors bold with a weight pill,
// minors muted and smaller, everything else plain.
function ItemRow({ d, course }: { d: Deliverable; course: Course }) {
  const s = score(d);
  const major = s >= MAJOR_SCORE;
  const minor = s < MINOR_SCORE;
  const weight = d.weightPercent !== null ? `${Number(d.weightPercent)}%` : null;

  return (
    <li>
      <Link
        href={`/course/${d.courseId}`}
        className={`flex items-center gap-2 rounded-md border-l-2 px-2 transition-colors hover:bg-muted/60 ${minor ? "py-0.5 text-xs text-muted-foreground" : "py-1 text-sm"}`}
        style={{ borderLeftColor: course.color }}
      >
        <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
          {formatDay(d.dueDate)}
        </span>
        <span className="hidden w-24 shrink-0 truncate text-muted-foreground sm:inline">
          {courseLabel(course)}
        </span>
        <span className={`min-w-0 flex-1 truncate ${major ? "font-semibold" : ""}`}>{d.title}</span>
        {weight ? (
          major ? (
            <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-semibold">
              {weight}
            </span>
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">{weight}</span>
          )
        ) : null}
      </Link>
    </li>
  );
}
