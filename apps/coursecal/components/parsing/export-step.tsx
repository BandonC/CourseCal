"use client";

import Link from "next/link";
import { useState } from "react";
import type { ParseResult } from "@coursecal/syllabus-parser";
import { exportToCalendarAction, saveSemesterAction } from "@/app/(app)/upload/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import type { CourseId } from "@/lib/db/ids";
import { buildIcs, icsFilename } from "@/lib/ics/build";

type Summary = { created: number; failed: number; reconnectNeeded: boolean };
type Phase = "idle" | "saving" | "syncing" | "done" | "error";

export function ExportStep({
  result,
  semesterName,
  semesterStart,
  semesterEnd,
  syllabusText,
  onRestart,
}: {
  result: ParseResult;
  semesterName: string;
  semesterStart: string;
  semesterEnd: string;
  syllabusText: string;
  onRestart: () => void;
}) {
  const [icsError, setIcsError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  // Set once the semester is persisted; a retry re-syncs (resumable) without
  // saving again, so it can't create a duplicate semester.
  const [courseId, setCourseId] = useState<CourseId | null>(null);

  function download() {
    setIcsError(null);
    const built = buildIcs(result);
    if (!built.ok) {
      setIcsError(built.error);
      return;
    }
    const blob = new Blob([built.value], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = icsFilename(result.course);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function addToCalendar() {
    setMessage(null);

    let cid = courseId;
    if (!cid) {
      setPhase("saving");
      const saved = await saveSemesterAction({
        semesterName,
        semesterStart,
        semesterEnd,
        syllabusText,
        result,
      });
      if (!saved.ok) {
        setPhase("error");
        setMessage(saved.error);
        return;
      }
      cid = saved.data.courseId;
      setCourseId(cid);
    }

    setPhase("syncing");
    const synced = await exportToCalendarAction(cid);
    if (!synced.ok) {
      setPhase("error");
      setMessage(synced.error);
      return;
    }
    setSummary(synced.data);
    setPhase("done");
  }

  const datedCount = result.deliverables.filter(
    (d) => d.recurrence !== null || d.due_date !== null,
  ).length;

  const busy = phase === "saving" || phase === "syncing";
  const buttonLabel =
    phase === "saving"
      ? "Saving…"
      : phase === "syncing"
        ? "Adding to Google Calendar…"
        : courseId
          ? "Retry adding to calendar"
          : "Add to Google Calendar";

  if (phase === "done" && summary) {
    return (
      <div className="space-y-4">
        <p>
          <span className="font-medium">{result.course.name}</span> was saved to{" "}
          {semesterName}.{" "}
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
        <div className="flex gap-3">
          {summary.reconnectNeeded ? (
            <Link href="/reconnect" className={buttonVariants()}>
              Reconnect Google
            </Link>
          ) : null}
          {summary.failed > 0 && !summary.reconnectNeeded ? (
            <Button onClick={addToCalendar} disabled={busy}>
              Retry
            </Button>
          ) : null}
          <Button variant="outline" onClick={download}>
            Download .ics
          </Button>
          <Button variant="ghost" onClick={onRestart}>
            Add another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p>
        <span className="font-medium">{result.course.name}</span> is ready. {datedCount} dated
        deliverable(s) will be added to your calendar; dateless items are skipped.
      </p>
      {phase === "error" && message ? (
        <p className="text-sm text-destructive">{message}</p>
      ) : null}
      {icsError ? <p className="text-sm text-destructive">{icsError}</p> : null}
      <div className="flex gap-3">
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
    </div>
  );
}
