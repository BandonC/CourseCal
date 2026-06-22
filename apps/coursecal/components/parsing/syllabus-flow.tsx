"use client";

import { useState } from "react";
import type { SemesterId } from "@/lib/db/ids";
import { ExportStep } from "./export-step";
import { ParseQueue } from "./parse-queue";
import { ReviewOverview } from "./review-overview";
import { SetupStep, type SetupSubmission } from "./setup-step";
import type { ParsedCourse, Semester, Source } from "./types";

// Orchestrates the multi-syllabus flow: setup (semester + sources) → sequential
// parse queue → whole-semester review (overview + edit-on-demand) → single
// save+export. When existingSemester is set the flow adds courses to that semester
// (§3.3): the setup step hides the semester fields and the export step saves via
// the add action instead of creating a new semester.
type Step =
  | { name: "setup" }
  | { name: "parsing"; semester: Semester; sources: Source[] }
  | { name: "review"; semester: Semester; courses: ParsedCourse[] }
  | { name: "export"; semester: Semester; courses: ParsedCourse[] };

export function SyllabusFlow({
  existingSemester,
}: {
  existingSemester?: { id: SemesterId; name: string; start: string; end: string };
}) {
  const [step, setStep] = useState<Step>({ name: "setup" });

  function startParsing({
    semesterName,
    semesterStart,
    semesterEnd,
    sources,
  }: SetupSubmission) {
    setStep({
      name: "parsing",
      semester: { name: semesterName, start: semesterStart, end: semesterEnd },
      sources,
    });
  }

  switch (step.name) {
    case "setup":
      return (
        <SetupStep
          onSubmit={startParsing}
          existingSemester={
            existingSemester
              ? {
                  name: existingSemester.name,
                  start: existingSemester.start,
                  end: existingSemester.end,
                }
              : undefined
          }
        />
      );

    case "parsing":
      return (
        <ParseQueue
          sources={step.sources}
          semesterStart={step.semester.start}
          semesterEnd={step.semester.end}
          onComplete={(courses) =>
            setStep({ name: "review", semester: step.semester, courses })
          }
          onRestart={() => setStep({ name: "setup" })}
        />
      );

    case "review":
      return (
        <ReviewOverview
          courses={step.courses}
          onConfirm={(courses) =>
            setStep({ name: "export", semester: step.semester, courses })
          }
          onRestart={() => setStep({ name: "setup" })}
        />
      );

    case "export":
      return (
        <ExportStep
          semester={step.semester}
          courses={step.courses}
          existingSemesterId={existingSemester?.id}
          onRestart={() => setStep({ name: "setup" })}
        />
      );
  }
}
