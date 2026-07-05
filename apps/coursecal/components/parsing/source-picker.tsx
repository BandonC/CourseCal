"use client";

import { FileUpIcon, PlusIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cleanPastedText } from "@/lib/extract";
import type { Source } from "./types";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isDocx(file: File): boolean {
  return file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
}

// Collects syllabus sources — any mix of dropped/chosen PDFs, Word docs, and pasted
// text — into the parent's `sources` state. Files aren't extracted here; that
// happens in the parse queue, one at a time. Client-side file-type checks are UX
// only; the server validates extracted text (apps/coursecal/CLAUDE.md). Extracted
// from SetupStep so both the new-semester and add-course flows share one picker.
export function SourcePicker({
  sources,
  setSources,
}: {
  sources: Source[];
  setSources: React.Dispatch<React.SetStateAction<Source[]>>;
}) {
  const [pasteText, setPasteText] = useState("");
  const [pasteLabel, setPasteLabel] = useState("");
  // The paste composer starts open for discoverability, then collapses after a
  // paste is saved so an empty box doesn't sit next to the saved item (misleading).
  // A link reopens it fresh; Edit reopens it with an existing paste's text.
  const [composerOpen, setComposerOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const picked = [...files];
    const supported = picked.filter((f) => isPdf(f) || isDocx(f));
    setError(
      supported.length < picked.length
        ? "Some files weren't PDFs or Word (.docx) files and were skipped."
        : null,
    );
    setSources((prev) => [
      ...prev,
      ...supported.map((file): Source =>
        isPdf(file)
          ? { id: crypto.randomUUID(), kind: "pdf", label: file.name, file }
          : { id: crypto.randomUUID(), kind: "docx", label: file.name, file },
      ),
    ]);
  }

  function savePaste() {
    // Strip stray HTML markup (§2.3) before storing — a plain textarea usually
    // yields plain text, but some sources drop tags into text/plain.
    const cleaned = cleanPastedText(pasteText);
    if (cleaned.trim().length === 0) {
      setError("Paste some syllabus text first.");
      return;
    }
    const label = pasteLabel.trim();
    if (editingId) {
      setSources((prev) =>
        prev.map((s) =>
          s.id === editingId && s.kind === "paste"
            ? { ...s, label: label || s.label, text: cleaned }
            : s,
        ),
      );
    } else {
      const n = sources.filter((s) => s.kind === "paste").length + 1;
      setSources((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "paste", label: label || `Pasted syllabus ${n}`, text: cleaned },
      ]);
    }
    closeComposer();
  }

  function editPaste(id: string) {
    const src = sources.find((s) => s.id === id);
    if (!src || src.kind !== "paste") return;
    setPasteText(src.text);
    setPasteLabel(src.label);
    setEditingId(id);
    setComposerOpen(true);
    setError(null);
  }

  function openComposer() {
    setPasteText("");
    setPasteLabel("");
    setEditingId(null);
    setComposerOpen(true);
    setError(null);
  }

  function closeComposer() {
    setPasteText("");
    setPasteLabel("");
    setEditingId(null);
    setComposerOpen(false);
    setError(null);
  }

  function remove(id: string) {
    setSources((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) closeComposer();
  }

  const hasPaste = sources.some((s) => s.kind === "paste");

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
          accept={`application/pdf,.pdf,${DOCX_MIME},.docx`}
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
        <span className="font-medium">Drop PDFs or Word docs here, or click to choose</span>
        <span className="text-muted-foreground">
          Add one syllabus per course. Files are read in your browser — only the
          extracted text is sent.
        </span>
      </div>

      {composerOpen ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm">
          <Label htmlFor="paste-text">{editingId ? "Edit pasted syllabus" : "Or paste a syllabus"}</Label>
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
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={savePaste}>
              {editingId ? "Save changes" : "Add pasted syllabus"}
            </Button>
            {sources.length > 0 ? (
              <Button type="button" variant="ghost" onClick={closeComposer}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" className="gap-2" onClick={openComposer}>
          <PlusIcon className="size-4" />
          {hasPaste ? "Paste another syllabus" : "Paste a syllabus"}
        </Button>
      )}

      {sources.length > 0 ? (
        <ul className="space-y-2">
          {sources.map((s) => (
            <li
              key={s.id}
              className={`flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm ${editingId === s.id ? "border-ring" : "border-border"}`}
            >
              <span className="min-w-0 truncate">
                <span className="text-muted-foreground">
                  {s.kind === "pdf" ? "PDF" : s.kind === "docx" ? "Word" : "Pasted"} ·{" "}
                </span>
                {s.label}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {s.kind === "paste" ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => editPaste(s.id)}>
                    Edit
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(s.id)}>
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
