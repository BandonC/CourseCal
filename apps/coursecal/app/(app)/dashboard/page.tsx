import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { DeleteSemesterButton } from "@/components/semester/delete-semester-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your semesters</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium">{user.email}</span>
        </p>
      </header>

      {semesters.length === 0 ? (
        <EmptyState
          title="No semesters yet"
          description="Upload your course syllabi and Coursecal builds your semester plan — every deadline on a timeline, hell weeks flagged, exported to Google Calendar."
          action={
            <Link href="/upload" className={buttonVariants()}>
              New semester
            </Link>
          }
        />
      ) : (
        <ul className="space-y-5">
          {semesters.map((s) => (
            <li key={s.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">
                    <Link href={`/semester/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {s.startDate} → {s.endDate}
                  </CardDescription>
                  <CardAction>
                    <DeleteSemesterButton semesterId={s.id} semesterName={s.name} />
                  </CardAction>
                </CardHeader>
                <CardContent>
                  {s.courses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No courses.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {s.courses.map((c) => (
                        <CourseRow key={c.id} course={c} />
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
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
        className="group flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:bg-muted/40"
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: course.color }}
          aria-hidden
        />
        <span className="text-primary underline decoration-primary/40 underline-offset-2 group-hover:decoration-primary">
          {course.code ? <span className="font-medium">{course.code} </span> : null}
          <span className={course.code ? "font-normal" : "font-medium"}>{course.name}</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {course.total} {course.total === 1 ? "item" : "items"}
          </span>
          {course.toCheck > 0 ? (
            <Badge variant="secondary">{course.toCheck} to check</Badge>
          ) : null}
          {course.unsynced > 0 ? (
            <Badge variant="outline">{course.unsynced} unsynced</Badge>
          ) : null}
        </span>
      </Link>
    </li>
  );
}
