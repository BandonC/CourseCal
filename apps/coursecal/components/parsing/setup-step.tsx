"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SourcePicker } from "./source-picker";
import type { Source } from "./types";

export type SetupSubmission = {
  semesterName: string;
  semesterStart: string;
  semesterEnd: string;
  sources: Source[];
};

// Step 1 of the flow. For a new semester it collects the name + dates and the
// sources; for the add-course flow (existingSemester set) the semester is already
// named/dated, so those fields are hidden and their values come from the existing
// semester — only sources are collected. The source UI itself is the shared
// SourcePicker.
export function SetupStep({
  onSubmit,
  existingSemester,
}: {
  onSubmit: (submission: SetupSubmission) => void;
  existingSemester?: { name: string; start: string; end: string };
}) {
  const [semesterName, setSemesterName] = useState(existingSemester?.name ?? "");
  const [semesterStart, setSemesterStart] = useState(existingSemester?.start ?? "");
  const [semesterEnd, setSemesterEnd] = useState(existingSemester?.end ?? "");
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!existingSemester) {
      if (semesterName.trim().length === 0) return setError("Give the semester a name.");
      if (!semesterStart || !semesterEnd)
        return setError("Enter the semester start and end dates.");
      if (semesterEnd < semesterStart)
        return setError("The semester end date can't be before the start date.");
    }
    if (sources.length === 0) return setError("Add at least one syllabus.");
    setError(null);
    onSubmit({ semesterName, semesterStart, semesterEnd, sources });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {existingSemester ? (
        <p className="text-sm text-muted-foreground">
          Adding courses to{" "}
          <span className="font-medium text-foreground">{existingSemester.name}</span> (
          {existingSemester.start} → {existingSemester.end}).
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="semester-name">Semester name</Label>
            <Input
              id="semester-name"
              type="text"
              value={semesterName}
              onChange={(e) => setSemesterName(e.target.value)}
              placeholder="e.g. Fall 2026"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="semester-start">Semester start</Label>
              <Input
                id="semester-start"
                type="date"
                value={semesterStart}
                onChange={(e) => setSemesterStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="semester-end">Semester end</Label>
              <Input
                id="semester-end"
                type="date"
                value={semesterEnd}
                onChange={(e) => setSemesterEnd(e.target.value)}
                required
              />
            </div>
          </div>
        </>
      )}

      <SourcePicker sources={sources} setSources={setSources} />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={sources.length === 0}>
        Parse {sources.length || ""} {sources.length === 1 ? "syllabus" : "syllabi"}
      </Button>
    </form>
  );
}
