import Link from "next/link";
import { DeleteSemesterButton } from "@/components/semester/delete-semester-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { requireUser } from "@/lib/auth/session";
import { getDashboardData, type DashboardCourse } from "@/lib/db/queries/semesters";

// The dashboard (COURSECAL.md §3.2): every semester the signed-in user owns, each
// with its courses and per-course counts, linking into the timeline (§3.1 step 9)
// and the course detail/edit page. Server component — data is read userId-scoped
// in getDashboardData and passed down; the (app) layout already gated the session.
export default async function DashboardPage() {
  const user = await requireUser();
  const semesters = await getDashboardData(user.userId);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your semesters</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium">{user.email}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/upload" className={buttonVariants()}>
            New semester
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      {semesters.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground">
            No semesters yet. Upload your syllabi to build your first plan.
          </p>
          <Link href="/upload" className={buttonVariants()}>
            New semester
          </Link>
        </div>
      ) : (
        <ul className="space-y-6">
          {semesters.map((s) => (
            <li key={s.id} className="space-y-4 rounded-lg border border-border p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/semester/${s.id}`}
                  className="text-xl font-medium tracking-tight hover:underline"
                >
                  {s.name}
                </Link>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {s.startDate} → {s.endDate}
                  </span>
                  <DeleteSemesterButton semesterId={s.id} semesterName={s.name} />
                </div>
              </div>

              {s.courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No courses.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {s.courses.map((c) => (
                    <CourseRow key={c.id} course={c} />
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function CourseRow({ course }: { course: DashboardCourse }) {
  return (
    <li>
      <Link
        href={`/course/${course.id}`}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:bg-muted/40"
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: course.color }}
          aria-hidden
        />
        {course.code ? (
          <span className="font-medium">{course.code}</span>
        ) : null}
        <span className={course.code ? "text-muted-foreground" : "font-medium"}>
          {course.name}
        </span>
        <span className="ml-auto text-sm text-muted-foreground">
          {course.total} {course.total === 1 ? "item" : "items"}
        </span>
        {course.toCheck > 0 ? (
          <Badge variant="secondary">{course.toCheck} to check</Badge>
        ) : null}
        {course.unsynced > 0 ? (
          <Badge variant="outline">{course.unsynced} unsynced</Badge>
        ) : null}
      </Link>
    </li>
  );
}
