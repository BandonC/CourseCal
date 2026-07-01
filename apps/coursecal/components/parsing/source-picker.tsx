"use client";

import { FileUpIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Source } from "./types";

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

// Collects syllabus sources — any mix of dropped/chosen PDFs and pasted text —
// into the parent's `sources` state. PDFs aren't extracted here; that happens in
// the parse queue, one at a time. Client-side file-type checks are UX only; the
// server validates extracted text (apps/coursecal/CLAUDE.md). Extracted from
// SetupStep so both the new-semester and add-course flows share one picker.
export function SourcePicker({
  sources,
  setSources,
}: {
  sources: Source[];
  setSources: React.Dispatch<React.SetStateAction<Source[]>>;
}) {
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

  return (
    <div className="space-y-6">
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
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center text-sm transition-colors ${dragActive ? "border-ring bg-accent" : "border-input bg-card hover:bg-muted/40"}`}
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
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-primary">
          <FileUpIcon className="size-5" />
        </span>
        <span className="font-medium">Drop PDFs here, or click to choose</span>
        <span className="text-muted-foreground">
          Add one syllabus per course. Files are read in your browser — only the
          extracted text is sent.
        </span>
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm">
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
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
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
    </div>
  );
}
