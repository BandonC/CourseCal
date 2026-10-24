import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { SyllabusFlow } from "@/components/parsing/syllabus-flow";
import { requireUser } from "@/lib/auth/session";
import type { SemesterId } from "@/lib/db/ids";
import { getSemesterBasics } from "@/lib/db/queries/semesters";

// Add course(s) to an existing semester (§3.3). Server component: resolves the
// session, loads the userId-scoped semester (404 when missing or not owned), and
// hands it to the shared flow, which skips the semester-fields step and saves via
// the add action. Gated by the (app) layout.
export default async function AddCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) notFound();

  const semester = await getSemesterBasics(user.userId, parsed.data as SemesterId);
  if (!semester) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
      <BackLink href={`/semester/${semester.id}`}>Back to semester</BackLink>
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Add courses</h1>
        <p className="text-muted-foreground">{semester.name}</p>
      </header>
      <SyllabusFlow
        existingSemester={{
          id: semester.id,
          name: semester.name,
          start: semester.startDate,
          end: semester.endDate,
        }}
      />
    </main>
  );
}
