"use client";

import { useState } from "react";
import type { ParseResult } from "@coursecal/syllabus-parser";
import { parseSyllabusAction } from "@/app/(app)/upload/actions";
import { Button } from "@/components/ui/button";
import { ExportStep } from "./export-step";
import { ReviewStep } from "./review-step";
import { UploadStep, type UploadSubmission } from "./upload-step";

// Everything the save step (chunk 4) needs travels with the result once parsed:
// the semester name + bounds the user entered, alongside the edited ParseResult.
type FlowData = {
  result: ParseResult;
  semesterName: string;
  semesterStart: string;
  semesterEnd: string;
};

type Step =
  | { name: "input" }
  | { name: "parsing" }
  | { name: "review"; data: FlowData }
  | { name: "ready"; data: FlowData }
  | { name: "error"; message: string };

export function SyllabusFlow() {
  const [step, setStep] = useState<Step>({ name: "input" });

  async function handleSubmit({
    text,
    semesterName,
    semesterStart,
    semesterEnd,
  }: UploadSubmission) {
    setStep({ name: "parsing" });

    // today/timezone come from the browser, not the server (server time is UTC on
    // Vercel). en-CA formats as ISO YYYY-MM-DD, the shape the library expects.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());

    const result = await parseSyllabusAction({
      text,
      context: { semesterStart, semesterEnd, today, timezone },
    });

    if (!result.ok) {
      setStep({ name: "error", message: result.error });
      return;
    }
    // dryRun is never requested here, so the action returns a ParseResult.
    if ("deliverables" in result.data) {
      setStep({
        name: "review",
        data: { result: result.data, semesterName, semesterStart, semesterEnd },
      });
    } else {
      setStep({ name: "error", message: "The parser returned an unexpected result." });
    }
  }

  switch (step.name) {
    case "input":
      return <UploadStep onSubmit={handleSubmit} />;
    case "parsing":
      return (
        <p className="text-muted-foreground" role="status">
          Parsing your syllabus… this can take up to a minute.
        </p>
      );
    case "review":
      return (
        <ReviewStep
          result={step.data.result}
          onConfirm={(result) =>
            setStep({ name: "ready", data: { ...step.data, result } })
          }
          onRestart={() => setStep({ name: "input" })}
        />
      );
    case "ready":
      return (
        <ExportStep
          result={step.data.result}
          onRestart={() => setStep({ name: "input" })}
        />
      );
    case "error":
      return (
        <div className="space-y-3">
          <p className="text-destructive">{step.message}</p>
          <Button variant="outline" onClick={() => setStep({ name: "input" })}>
            Try again
          </Button>
        </div>
      );
  }
}
