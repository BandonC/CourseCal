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

const STEP_LABELS = ["Setup", "Parse", "Review", "Export"] as const;
const STEP_INDEX: Record<Step["name"], number> = {
  setup: 0,
  parsing: 1,
  review: 2,
  export: 3,
};

// Step indicator across the top of the flow — orients the user without any
// navigation of its own (the steps advance as the flow progresses).
function FlowSteps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      {STEP_LABELS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex size-6 items-center justify-center rounded-full text-xs font-medium ${
                state === "todo"
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span className={state === "current" ? "font-medium" : "text-muted-foreground"}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function SyllabusFlow({
  existingSemester,
}: {
  existingSemester?: { id: SemesterId; name: string; start: string; end: string };
}) {
  const [step, setStep] = useState<Step>({ name: "setup" });
  // The semester courses are added to: the prop (add-course route) or, in the
  // new-semester flow, the semester just created this session. Tracking the latter
  // lets the export screen offer "Add another course" without a detour through the
  // timeline. active = whichever applies; null means a fresh new semester.
  const [createdSemester, setCreatedSemester] = useState<{
    id: SemesterId;
    name: string;
    start: string;
    end: string;
  } | null>(null);
  const active = existingSemester ?? createdSemester;

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

  return (
    <div className="space-y-8">
      <FlowSteps current={STEP_INDEX[step.name]} />
      {renderStep()}
    </div>
  );

  function renderStep() {
    switch (step.name) {
      case "setup":
        return (
          <SetupStep
            onSubmit={startParsing}
            existingSemester={
              active ? { name: active.name, start: active.start, end: active.end } : undefined
            }
          />
        );

      case "parsing":
        return (
          <ParseQueue
            sources={step.sources}
            semesterStart={step.semester.start}
            semesterEnd={step.semester.end}
            isAddToExisting={!!active}
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
            existingSemesterId={active?.id}
            canStartNew={!existingSemester}
            onRestart={() => setStep({ name: "setup" })}
            onAddAnother={(target) => {
              setCreatedSemester(target);
              setStep({ name: "setup" });
            }}
            onNewSemester={() => {
              setCreatedSemester(null);
              setStep({ name: "setup" });
            }}
          />
        );
    }
  }
}
