"use client";

import { useState } from "react";
import type { ParseResult } from "@coursecal/syllabus-parser";
import { buildIcs, icsFilename } from "@/lib/ics/build";
import { Button } from "@/components/ui/button";

export function ExportStep({
  result,
  onRestart,
}: {
  result: ParseResult;
  onRestart: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function download() {
    setError(null);
    const built = buildIcs(result);
    if (!built.ok) {
      setError(built.error);
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

  const datedCount = result.deliverables.filter(
    (d) => d.recurrence !== null || d.due_date !== null,
  ).length;

  return (
    <div className="space-y-4">
      <p>
        <span className="font-medium">{result.course.name}</span> is ready. {datedCount} dated
        deliverable(s) will be added to your calendar; dateless items are skipped.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-3">
        <Button onClick={download}>Download .ics</Button>
        <Button variant="outline" onClick={onRestart}>
          Start over
        </Button>
      </div>
    </div>
  );
}
