"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Source } from "./types";

export type SetupSubmission = {
  semesterName: string;
  semesterStart: string;
  semesterEnd: string;
  sources: Source[];
};

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

// Collects the semester (named + dated once) and a list of syllabus sources — any
// mix of PDFs and pasted text. PDFs aren't extracted here; that happens in the
// parse queue (one file at a time). Client-side file-type checks are UX only; the
// server validates the extracted text (apps/coursecal/CLAUDE.md).
export function SetupStep({
  onSubmit,
}: {
  onSubmit: (submission: SetupSubmission) => void;
}) {
  const [semesterName, setSemesterName] = useState("");
  const [semesterStart, setSemesterStart] = useState("");
  const [semesterEnd, setSemesterEnd] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [pasteLabel, setPasteLabel] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const picked = [...files];
    const pdfs = picked.filter(isPdf);
    setError(pdfs.length < picked.length ? "Some files weren't PDFs and were skipped." : null);
    setSources((prev) => [
      ...prev,
      ...pdfs.map((file) => ({
        id: crypto.randomUUID(),
        kind: "pdf" as const,
        label: file.name,
        file,
      })),
    ]);
  }

  function addPaste() {
    if (pasteText.trim().length === 0) {
      setError("Paste some syllabus text first.");
      return;
    }
    setSources((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind: "paste",
        label: pasteLabel.trim() || `Pasted syllabus ${prev.length + 1}`,
        text: pasteText,
      },
    ]);
    setPasteText("");
    setPasteLabel("");
    setError(null);
  }

  function remove(id: string) {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (semesterName.trim().length === 0) return setError("Give the semester a name.");
    if (!semesterStart || !semesterEnd) return setError("Enter the semester start and end dates.");
    if (semesterEnd < semesterStart)
      return setError("The semester end date can't be before the start date.");
    if (sources.length === 0) return setError("Add at least one syllabus.");
    onSubmit({ semesterName, semesterStart, semesterEnd, sources });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInput.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-6 py-10 text-center text-sm ${dragActive ? "border-ring bg-muted/50" : "border-input"}`}
      >
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = ""; // allow re-adding the same file
          }}
        />
        <span className="font-medium">Drop PDFs here, or click to choose</span>
        <span className="text-muted-foreground">
          Add one syllabus per course. Files are read in your browser — only the
          extracted text is sent.
        </span>
      </div>

      <div className="space-y-2 rounded-lg border border-border p-4">
        <Label htmlFor="paste-text">Or paste a syllabus</Label>
        <Input
          id="paste-label"
          type="text"
          value={pasteLabel}
          onChange={(e) => setPasteLabel(e.target.value)}
          placeholder="Course name (optional)"
        />
        <Textarea
          id="paste-text"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste your syllabus text here…"
          className="min-h-32"
        />
        <Button type="button" variant="outline" onClick={addPaste}>
          Add pasted syllabus
        </Button>
      </div>

      {sources.length > 0 ? (
        <ul className="space-y-2">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="truncate">
                <span className="text-muted-foreground">
                  {s.kind === "pdf" ? "PDF" : "Pasted"} ·{" "}
                </span>
                {s.label}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(s.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={sources.length === 0}>
        Parse {sources.length || ""} {sources.length === 1 ? "syllabus" : "syllabi"}
      </Button>
    </form>
  );
}
