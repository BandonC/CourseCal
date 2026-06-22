import { notFound } from "next/navigation";
import { z } from "zod";
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

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{data.name}</h1>
        <p className="text-muted-foreground">
          {data.startDate} → {data.endDate}
        </p>
      </header>
      <SemesterTimeline data={data} report={report} />
    </main>
  );
}
