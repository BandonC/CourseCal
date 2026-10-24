import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { PrintScheduleButton } from "@/components/semester/print-schedule-button";
import { SemesterSchedule } from "@/components/semester/semester-schedule";
import { buttonVariants } from "@/components/ui/button";
import { captureServer } from "@/lib/analytics/posthog-server";
import { requireUser } from "@/lib/auth/session";
import { detectConflicts, type ConflictDeliverable } from "@/lib/conflict-detection";
import type { SemesterId } from "@/lib/db/ids";
import { getSemesterTimeline } from "@/lib/db/queries/semesters";
import { SemesterTimeline } from "./timeline";

// Semester timeline (COURSECAL.md §3.1 step 9). Server component: resolves the
// session, reads the userId-scoped semester, runs conflict detection, and renders
// the week axis. A missing semester or one owned by another user → 404 (the query
// scopes by userId, so the two are indistinguishable). Gated by the (app) layout.
export default async function SemesterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) notFound();

  const data = await getSemesterTimeline(user.userId, parsed.data as SemesterId);
  if (!data) notFound();

  const dated: ConflictDeliverable[] = data.courses.flatMap((c) =>
    c.deliverables
      .filter((d) => d.dueDate !== null)
      .map((d) => ({
        id: d.id,
        courseId: d.courseId,
        type: d.type,
        dueDate: d.dueDate as string,
        weightPercent: d.weightPercent !== null ? Number(d.weightPercent) : null,
      })),
  );

  const report = detectConflicts(dated, { start: data.startDate, end: data.endDate });

  // Runs after the response is sent, so the analytics flush never blocks render.
  after(() =>
    captureServer(user.userId, {
      name: "timeline_viewed",
      properties: {
        course_count: data.courses.length,
        deliverable_count: data.courses.reduce((s, c) => s + c.deliverables.length, 0),
        heavy_week_count: report.weeks.filter((w) => w.heavy).length,
        cluster_count: report.clusters.length,
      },
    }),
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
      <div className="flex flex-col gap-6 print:hidden">
        <BackLink href="/dashboard">Back to dashboard</BackLink>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <header className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{data.name}</h1>
            <p className="text-muted-foreground">
              {data.startDate} → {data.endDate}
            </p>
          </header>
          <div className="flex flex-wrap gap-2">
            <PrintScheduleButton semesterName={data.name} courseCount={data.courses.length} />
            <Link
              href={`/semester/${data.id}/add`}
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              Add course
            </Link>
          </div>
        </div>
        <SemesterTimeline data={data} report={report} />
      </div>
      <SemesterSchedule data={data} />
    </main>
  );
}
