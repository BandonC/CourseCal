"use client";

import { useState } from "react";
import type { ParseResult } from "@coursecal/syllabus-parser";
import { saveSemesterAction } from "@/app/(app)/upload/actions";
import { buildIcs, icsFilename } from "@/lib/ics/build";
import { Button } from "@/components/ui/button";

type SaveState =
  | { name: "idle" }
  | { name: "saving" }
  | { name: "saved" }
  | { name: "error"; message: string };

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
  const [save, setSave] = useState<SaveState>({ name: "idle" });

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

  async function saveSemester() {
    setSave({ name: "saving" });
    const res = await saveSemesterAction({
      semesterName,
      semesterStart,
      semesterEnd,
      syllabusText,
      result,
    });
    setSave(res.ok ? { name: "saved" } : { name: "error", message: res.error });
  }

  const datedCount = result.deliverables.filter(
    (d) => d.recurrence !== null || d.due_date !== null,
  ).length;

  if (save.name === "saved") {
    return (
      <div className="space-y-4">
        <p>
          <span className="font-medium">{result.course.name}</span> was saved to{" "}
          {semesterName}.
        </p>
        {icsError ? <p className="text-sm text-destructive">{icsError}</p> : null}
        <div className="flex gap-3">
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
      {save.name === "error" ? (
        <p className="text-sm text-destructive">{save.message}</p>
      ) : null}
      {icsError ? <p className="text-sm text-destructive">{icsError}</p> : null}
      <div className="flex gap-3">
        <Button onClick={saveSemester} disabled={save.name === "saving"}>
          {save.name === "saving" ? "Saving…" : "Save semester"}
        </Button>
        <Button variant="outline" onClick={download}>
          Download .ics
        </Button>
        <Button variant="ghost" onClick={onRestart}>
          Start over
        </Button>
      </div>
    </div>
  );
}
