"use client";

import { useRef, useState } from "react";
import { extractPdfText } from "@/lib/extract";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type UploadSubmission = {
  text: string;
  semesterStart: string;
  semesterEnd: string;
};

type Mode = "upload" | "paste";

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function UploadStep({
  onSubmit,
}: {
  onSubmit: (submission: UploadSubmission) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [semesterStart, setSemesterStart] = useState("");
  const [semesterEnd, setSemesterEnd] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Client-side file-type checks are UX only; the server validates the text
  // (apps/coursecal/CLAUDE.md). Reject obvious non-PDFs before extraction.
  function chooseFile(picked: File | undefined) {
    if (!picked) return;
    if (!isPdf(picked)) {
      setError("That doesn't look like a PDF. Choose a .pdf or switch to paste.");
      return;
    }
    setError(null);
    setFile(picked);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!semesterStart || !semesterEnd) {
      setError("Enter the semester start and end dates.");
      return;
    }
    if (semesterEnd < semesterStart) {
      setError("The semester end date can't be before the start date.");
      return;
    }

    let text: string;
    if (mode === "upload") {
      if (!file) {
        setError("Choose a PDF, or switch to paste.");
        return;
      }
      setExtracting(true);
      const extracted = await extractPdfText(file);
      setExtracting(false);
      if (!extracted.ok) {
        setError(extracted.error);
        return;
      }
      text = extracted.text;
    } else {
      if (pasted.trim().length === 0) {
        setError("Paste your syllabus text first.");
        return;
      }
      text = pasted;
    }

    await onSubmit({ text, semesterStart, semesterEnd });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <div className="inline-flex rounded-lg border border-input p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`rounded-md px-3 py-1 ${mode === "upload" ? "bg-muted font-medium" : "text-muted-foreground"}`}
        >
          Upload PDF
        </button>
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`rounded-md px-3 py-1 ${mode === "paste" ? "bg-muted font-medium" : "text-muted-foreground"}`}
        >
          Paste text
        </button>
      </div>

      {mode === "upload" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            chooseFile(e.dataTransfer.files[0]);
          }}
          onClick={() => fileInput.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-6 py-10 text-center text-sm ${dragActive ? "border-ring bg-muted/50" : "border-input"}`}
        >
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => chooseFile(e.target.files?.[0])}
          />
          <span className="font-medium">
            {file ? file.name : "Drop a PDF here, or click to choose"}
          </span>
          <span className="text-muted-foreground">
            The file is read in your browser — only the extracted text is sent.
          </span>
        </div>
      ) : (
        <Textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="Paste your syllabus text here…"
          className="min-h-56"
        />
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={extracting}>
        {extracting ? "Reading PDF…" : "Parse syllabus"}
      </Button>
    </form>
  );
}
