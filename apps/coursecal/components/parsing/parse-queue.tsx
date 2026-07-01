"use client";

import { useEffect, useRef, useState } from "react";
import { parseSyllabusAction } from "@/app/(app)/upload/actions";
import { Button } from "@/components/ui/button";
import { bucketCharCount } from "@/lib/analytics/events";
import { useAnalytics } from "@/lib/analytics/use-analytics";
import { extractPdfText } from "@/lib/extract";
import type { ParsedCourse, Source } from "./types";

type Status = "queued" | "extracting" | "parsing" | "done" | "failed";
type Item = { source: Source; status: Status; error?: string; parsed?: ParsedCourse };

const STATUS_LABEL: Record<Status, string> = {
  queued: "Queued",
  extracting: "Reading PDF…",
  parsing: "Parsing…",
  done: "Done",
  failed: "Failed",
};

// Sequential parse queue (apps/coursecal/CLAUDE.md performance — no parallel
// parsing). One source is extracted+parsed at a time; per-file status is client
// state. Failed items can be retried without re-running the successful ones.
export function ParseQueue({
  sources,
  semesterStart,
  semesterEnd,
  isAddToExisting,
  onComplete,
  onRestart,
}: {
  sources: Source[];
  semesterStart: string;
  semesterEnd: string;
  isAddToExisting: boolean;
  onComplete: (courses: ParsedCourse[]) => void;
  onRestart: () => void;
}) {
  const { capture } = useAnalytics();
  const [items, setItems] = useState<Item[]>(() =>
    sources.map((source) => ({ source, status: "queued" })),
  );
  const [running, setRunning] = useState(false);
  // StrictMode mounts effects twice in dev; guard so the queue runs once.
  const started = useRef(false);
  // One syllabus_uploaded per source regardless of retries.
  const uploaded = useRef<Set<string>>(new Set());

  function patch(index: number, next: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...next } : it)));
  }

  async function parseOne(source: Source, index: number): Promise<Item> {
    let text: string;
    if (source.kind === "pdf") {
      patch(index, { status: "extracting" });
      const extracted = await extractPdfText(source.file);
      if (!extracted.ok) return { source, status: "failed", error: extracted.error };
      text = extracted.text;
    } else {
      text = source.text;
    }

    if (!uploaded.current.has(source.id)) {
      uploaded.current.add(source.id);
      capture({
        name: "syllabus_uploaded",
        properties: {
          input_method: source.kind,
          char_count_bucket: bucketCharCount(text.length),
          is_add_to_existing: isAddToExisting,
        },
      });
    }

    patch(index, { status: "parsing" });
    // today/timezone come from the browser, not the server (Vercel runs UTC).
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());

    const result = await parseSyllabusAction({
      text,
      context: { semesterStart, semesterEnd, today, timezone },
    });
    if (!result.ok) return { source, status: "failed", error: result.error };
    if (!("deliverables" in result.data)) {
      return { source, status: "failed", error: "The parser returned an unexpected result." };
    }
    return {
      source,
      status: "done",
      parsed: {
        sourceId: source.id,
        label: source.label,
        result: result.data,
        syllabusText: text,
      },
    };
  }

  async function runQueue(indices: number[]) {
    setRunning(true);
    for (const index of indices) {
      const outcome = await parseOne(sources[index]!, index);
      patch(index, outcome);
    }
    setRunning(false);
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void runQueue(sources.map((_, i) => i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function retryFailed() {
    const failed = items.flatMap((it, i) => (it.status === "failed" ? [i] : []));
    for (const i of failed) patch(i, { status: "queued", error: undefined });
    void runQueue(failed);
  }

  const settled = !running && items.every((it) => it.status === "done" || it.status === "failed");
  const done = items.filter((it) => it.status === "done");
  const failedCount = items.filter((it) => it.status === "failed").length;

  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.source.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-xs"
          >
            <span className="truncate">{it.source.label}</span>
            <span
              className={
                it.status === "failed"
                  ? "text-destructive"
                  : it.status === "done"
                    ? "text-muted-foreground"
                    : ""
              }
              role="status"
            >
              {it.status === "extracting" || it.status === "parsing" ? (
                <span
                  className="mr-2 inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent align-[-1px]"
                  aria-hidden
                />
              ) : null}
              {STATUS_LABEL[it.status]}
            </span>
          </li>
        ))}
      </ul>

      {items.some((it) => it.status === "failed" && it.error) ? (
        <ul className="space-y-1 text-sm text-destructive">
          {items
            .filter((it) => it.status === "failed" && it.error)
            .map((it) => (
              <li key={`err-${it.source.id}`}>
                {it.source.label}: {it.error}
              </li>
            ))}
        </ul>
      ) : null}

      {settled ? (
        <div className="flex flex-wrap gap-3">
          {done.length > 0 ? (
            <Button onClick={() => onComplete(done.map((it) => it.parsed!))}>
              Review {done.length} {done.length === 1 ? "course" : "courses"}
            </Button>
          ) : null}
          {failedCount > 0 ? (
            <Button variant="outline" onClick={retryFailed}>
              Retry {failedCount} failed
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onRestart}>
            Start over
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground" role="status">
          Parsing your syllabi… this can take a minute each.
        </p>
      )}
    </div>
  );
}
