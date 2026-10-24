import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { CourseDeliverables } from "@/components/course/course-deliverables";
import { CourseHeaderEdit } from "@/components/course/course-header-edit";
import { DeleteCourseButton } from "@/components/course/delete-course-button";
import { ReparseCourse } from "@/components/course/reparse-course";
import { SyncCourseButton } from "@/components/course/sync-course-button";
import { requireUser } from "@/lib/auth/session";
import type { CourseId } from "@/lib/db/ids";
import { getCourseDetail } from "@/lib/db/queries/courses";
import { countSyncableForCourse } from "@/lib/db/queries/deliverables";

// Course detail (COURSECAL.md §3.2) — the edit surface. Server component: resolves
// the session, reads the userId-scoped course (404 when missing or not owned), and
// lists every deliverable with inline edit + delete. Gated by the (app) layout.
export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) notFound();

  const courseId = parsed.data as CourseId;
  const [course, unsyncedCount] = await Promise.all([
    getCourseDetail(user.userId, courseId),
    countSyncableForCourse(user.userId, courseId),
  ]);
  if (!course) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
      <BackLink href={`/semester/${course.semesterId}`}>Back to semester</BackLink>

      <div className="flex items-start justify-between gap-4">
        <CourseHeaderEdit
          courseId={course.id}
          name={course.name}
          code={course.code}
          instructor={course.instructor}
        />
        <DeleteCourseButton
          courseId={course.id}
          courseLabel={course.code ?? course.name}
          semesterId={course.semesterId}
        />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">
            Deliverables{" "}
            <span className="text-muted-foreground">({course.deliverables.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            {unsyncedCount > 0 ? (
              <SyncCourseButton courseId={course.id} count={unsyncedCount} />
            ) : null}
          </div>
        </div>

        {/* Full-width: idle it's a button; mid-review it expands to the review panel. */}
        <ReparseCourse courseId={course.id} />

        {/* Keyed on the current deliverable ids so a re-parse (which generates new
            ids) remounts the list with fresh server data; edits/deletes keep the
            same ids and drive the list's own local state. */}
        <CourseDeliverables
          key={course.deliverables.map((d) => d.id).join("-")}
          courseId={course.id}
          deliverables={course.deliverables}
        />
      </section>
    </main>
  );
}
