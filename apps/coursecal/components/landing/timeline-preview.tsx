import { Badge } from "@/components/ui/badge";

// Static, presentational mock of the semester timeline for the landing hero —
// it shows the product's differentiator (hell weeks + deadline clusters) using
// the real design tokens and course colors. Not wired to any data; mirrors the
// styling of app/(app)/semester/[id]/timeline.tsx so it reads as the real thing.
const COURSES = {
  cs: { label: "CS 247", color: "var(--chart-1)" },
  math: { label: "MATH 237", color: "var(--chart-2)" },
  phil: { label: "PHIL 256", color: "var(--chart-3)" },
} as const;

type CourseKey = keyof typeof COURSES;

const WEEKS: {
  label: string;
  range: string;
  load: number;
  heavy: boolean;
  items: { course: CourseKey; title: string; cluster: boolean }[];
}[] = [
  {
    label: "Week 5",
    range: "Oct 6–12",
    load: 12,
    heavy: false,
    items: [
      { course: "cs", title: "Assignment 3", cluster: false },
      { course: "math", title: "Quiz 4", cluster: false },
    ],
  },
  {
    label: "Week 6",
    range: "Oct 13–19",
    load: 41,
    heavy: true,
    items: [
      { course: "cs", title: "Midterm", cluster: true },
      { course: "phil", title: "Essay", cluster: true },
      { course: "math", title: "Midterm", cluster: false },
    ],
  },
];

export function TimelinePreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="font-heading text-sm font-semibold tracking-tight">
          Fall 2026
        </h3>
        <Badge variant="destructive">1 hell week</Badge>
      </div>

      <ol className="space-y-2 p-4" aria-hidden>
        {WEEKS.map((w) => (
          <li
            key={w.label}
            className={`rounded-lg border p-3 ${
              w.heavy
                ? "border-destructive/30 bg-destructive/5"
                : "border-border"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">
                {w.label}{" "}
                <span className="font-normal text-muted-foreground">
                  · {w.range}
                </span>
              </p>
              <span className="text-xs text-muted-foreground">
                {w.heavy ? (
                  <span className="font-medium text-destructive">
                    Hell week ·{" "}
                  </span>
                ) : null}
                load {w.load}
              </span>
            </div>

            <ul className="mt-2 space-y-1.5">
              {w.items.map((d) => {
                const c = COURSES[d.course];
                return (
                  <li
                    key={`${w.label}-${d.course}-${d.title}`}
                    className="flex items-center gap-1.5 rounded-md border-l-2 bg-muted/40 px-2 py-1.5 text-sm"
                    style={{ borderLeftColor: c.color }}
                  >
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="truncate">{d.title}</span>
                    {d.cluster ? (
                      <span className="ml-auto rounded bg-destructive/10 px-1 text-[10px] font-medium text-destructive">
                        cluster
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
