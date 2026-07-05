"use client";

import { CalendarCheckIcon } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import {
  addCoursesToSemesterAction,
  exportSemesterToCalendarAction,
  saveSemesterAction,
} from "@/app/(app)/upload/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAnalytics } from "@/lib/analytics/use-analytics";
import type { SemesterId } from "@/lib/db/ids";
import { buildIcsForCourses } from "@/lib/ics/build";
import type { ParsedCourse, Semester } from "./types";

type Summary = { created: number; failed: number; reconnectNeeded: boolean };
type Phase = "idle" | "saving" | "syncing" | "done" | "error";

function datedCount(courses: ParsedCourse[]): number {
  return courses.reduce(
    (sum, c) =>
      sum +
      c.result.deliverables.filter((d) => d.recurrence !== null || d.due_date !== null).length,
    0,
  );
}

export function ExportStep({
  semester,
  courses,
  existingSemesterId,
  canStartNew,
  onRestart,
  onAddAnother,
  onNewSemester,
}: {
  semester: Semester;
  courses: ParsedCourse[];
  // Set when adding to an existing semester — the save goes through the add action
  // instead of creating a new semester.
  existingSemesterId?: SemesterId;
  // Whether a fresh "New semester" is offered (false on the add-course route, which
  // is scoped to one semester).
  canStartNew: boolean;
  // "Start over" (pre-export): back to setup, keeping the current add-target.
  onRestart: () => void;
  // "Add another course" (post-save): re-enter the flow adding to the just-saved semester.
  onAddAnother: (target: { id: SemesterId; name: string; start: string; end: string }) => void;
  // "New semester" (post-save): back to setup for a brand-new semester.
  onNewSemester: () => void;
}) {
  const { capture } = useAnalytics();
  const [icsError, setIcsError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  // Set once the semester is persisted; a retry re-syncs (resumable) without
  // saving again, so it can't create a duplicate semester.
  const [semesterId, setSemesterId] = useState<SemesterId | null>(null);

  function download() {
    setIcsError(null);
    const built = buildIcsForCourses(
      courses.map((c) => c.result),
      semester.name,
    );
    if (!built.ok) {
      setIcsError(built.error);
      return;
    }
    capture({ name: "ics_downloaded", properties: { course_count: courses.length } });
    const blob = new Blob([built.value], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const slug = semester.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    anchor.download = `${slug || "semester"}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function addToCalendar() {
    setMessage(null);
    capture({
      name: "export_to_calendar_clicked",
      properties: {
        course_count: courses.length,
        dated_deliverable_count: datedCount(courses),
        is_add_to_existing: !!existingSemesterId,
      },
    });

    let sid = semesterId;
    if (!sid) {
      setPhase("saving");
      const payload = {
        courses: courses.map((c) => ({ syllabusText: c.syllabusText, result: c.result })),
      };
      const saved = existingSemesterId
        ? await addCoursesToSemesterAction({ semesterId: existingSemesterId, ...payload })
        : await saveSemesterAction({
            semesterName: semester.name,
            semesterStart: semester.start,
            semesterEnd: semester.end,
            ...payload,
          });
      if (!saved.ok) {
        setPhase("error");
        setMessage(saved.error);
        return;
      }
      sid = saved.data.semesterId;
      setSemesterId(sid);
    }

    setPhase("syncing");
    const synced = await exportSemesterToCalendarAction(sid);
    if (!synced.ok) {
      setPhase("error");
      setMessage(synced.error);
      return;
    }
    setSummary(synced.data);
    setPhase("done");
  }

  const busy = phase === "saving" || phase === "syncing";
  const buttonLabel =
    phase === "saving"
      ? "Saving…"
      : phase === "syncing"
        ? "Adding to Google Calendar…"
        : semesterId
          ? "Retry adding to calendar"
          : "Add to Google Calendar";

  if (phase === "done" && summary) {
    return (
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
              <CalendarCheckIcon className="size-5" />
            </span>
            <p className="font-heading text-lg font-semibold tracking-tight">
              {existingSemesterId ? "Courses added" : "Semester saved"}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {existingSemesterId
              ? `${courses.length} ${courses.length === 1 ? "course" : "courses"} added to `
              : null}
            <span className="font-medium text-foreground">{semester.name}</span>
            {existingSemesterId
              ? "."
              : ` (${courses.length} ${courses.length === 1 ? "course" : "courses"}) was saved.`}{" "}
            {summary.created > 0
              ? `${summary.created} event(s) added to Google Calendar.`
              : "No new events to add."}
          </p>
          {summary.failed > 0 ? (
            <p className="text-sm text-destructive">
              {summary.failed} event(s) couldn&apos;t be added.
            </p>
          ) : null}
          {summary.reconnectNeeded ? (
            <p className="text-sm text-destructive">
              Your Google access expired. Reconnect to finish adding events.
            </p>
          ) : null}
          {icsError ? <p className="text-sm text-destructive">{icsError}</p> : null}
          <div className="flex flex-wrap gap-3">
            {semesterId ? (
              <Link href={`/semester/${semesterId}`} className={buttonVariants()}>
                View timeline
              </Link>
            ) : null}
            {summary.reconnectNeeded ? (
              <Link href="/reconnect" className={buttonVariants({ variant: "outline" })}>
                Reconnect Google
              </Link>
            ) : null}
            {summary.failed > 0 && !summary.reconnectNeeded ? (
              <Button onClick={addToCalendar} disabled={busy}>
                Retry
              </Button>
            ) : null}
            {semesterId ? (
              <Button
                variant="outline"
                onClick={() =>
                  onAddAnother({
                    id: semesterId,
                    name: semester.name,
                    start: semester.start,
                    end: semester.end,
                  })
                }
              >
                Add another course
              </Button>
            ) : null}
            <Button variant="outline" onClick={download}>
              Download .ics
            </Button>
            {canStartNew ? (
              <Button variant="ghost" onClick={onNewSemester}>
                New semester
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{semester.name}</span> is ready with{" "}
          {courses.length} {courses.length === 1 ? "course" : "courses"}. {datedCount(courses)}{" "}
          dated deliverable(s) will be added to your calendar; dateless items are skipped.
        </p>
        {phase === "error" && message ? (
          <p className="text-sm text-destructive">{message}</p>
        ) : null}
        {icsError ? <p className="text-sm text-destructive">{icsError}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button onClick={addToCalendar} disabled={busy}>
            {buttonLabel}
          </Button>
          <Button variant="outline" onClick={download}>
            Download .ics
          </Button>
          <Button variant="ghost" onClick={onRestart} disabled={busy}>
            Start over
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
