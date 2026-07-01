import Link from "next/link";
import { PencilIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ConflictReport } from "@/lib/conflict-detection";
import type { SemesterTimelineData } from "@/lib/db/queries/semesters";

// Server component: deliverables on a vertical week axis (apps/coursecal/CLAUDE.md
// — CSS grid/flex, no charting libs). Hell weeks (Layer 1) tint the row; clustered
// items (Layer 2) get a warning tag. Course colors are the stored --chart-N vars,
// applied inline (the one sanctioned dynamic-style case — see lib/courses/colors).

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function shortDate(iso: string): string {
  const [, m = 1, d = 1] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

type Course = SemesterTimelineData["courses"][number];

function courseLabel(c: Course): string {
  return c.code ?? c.name;
}

export function SemesterTimeline({
  data,
  report,
}: {
  data: SemesterTimelineData;
  report: ConflictReport;
}) {
  const courseById = new Map(data.courses.map((c) => [c.id, c]));

  const dated = data.courses
    .flatMap((c) => c.deliverables)
    .filter((d) => d.dueDate !== null)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

  const clustered = new Set(report.clusters.flatMap((c) => c.deliverableIds));
  const heavyCount = report.weeks.filter((w) => w.heavy).length;
  const crossCourseClusters = report.clusters.filter((c) => c.crossCourse).length;

  // Bucket each dated deliverable into its week by date range (the weeks are
  // contiguous and cover the term). Small N, so the nested scan is fine.
  const weeks = report.weeks.map((w) => ({
    ...w,
    items: dated.filter((d) => d.dueDate! >= w.start && d.dueDate! <= w.end),
  }));

  if (dated.length === 0) {
    return (
      <p className="text-muted-foreground">
        No dated deliverables to plot. Dateless items (e.g. participation) don&apos;t
        appear on the timeline.
      </p>
    );
  }

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
              className="flex items-center gap-1.5 hover:underline"
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: c.color }}
                aria-hidden
              />
              {courseLabel(c)}
            </Link>
          </li>
        ))}
      </ul>

      <ol className="space-y-2">
        {weeks.map((w) => (
          <li
            key={w.index}
            className={`rounded-xl border p-3 shadow-xs ${w.heavy ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium">
                Week {w.index}{" "}
                <span className="font-normal text-muted-foreground">
                  · {shortDate(w.start)}–{shortDate(w.end)}
                </span>
              </h2>
              <span className="text-xs text-muted-foreground">
                {w.heavy ? (
                  <span className="font-medium text-destructive">Hell week · </span>
                ) : null}
                load {Math.round(w.workload)}
              </span>
            </div>

            {w.items.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">—</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {w.items.map((d) => {
                  const c = courseById.get(d.courseId)!;
                  return (
                    <li key={d.id}>
                      <Link
                        href={`/course/${d.courseId}`}
                        className="group flex items-center gap-2 rounded-md border-l-2 bg-muted/30 px-2 py-1.5 transition-colors hover:bg-muted/60"
                        style={{ borderLeftColor: c.color }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-sm">
                            <span className="truncate">{d.title}</span>
                            {clustered.has(d.id) ? (
                              <span className="rounded bg-destructive/10 px-1 text-[10px] font-medium text-destructive">
                                cluster
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {courseLabel(c)} · {shortDate(d.dueDate!)}
                            {d.dueTime ? ` ${d.dueTime.slice(0, 5)}` : ""} ·{" "}
                            <span className="capitalize">{d.type}</span>
                            {d.weightPercent ? ` · ${Number(d.weightPercent)}%` : ""}
                          </p>
                        </div>
                        <PencilIcon
                          className="size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
