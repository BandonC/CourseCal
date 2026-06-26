// Regex baseline (COURSECAL §12.1): a deliberately crude date-regex + keyword-type
// classifier, built once and never iterated, to quantify the LLM's lift. It walks the
// text for "Month Day" dates, grabs the nearest preceding keyword for the type/title,
// and reads a "N%" weight if one is close. It has no notion of recurrence, dateless
// items, or relative dates — those misses are the point of the comparison.

import type { Deliverable, DeliverableType, ParseResult } from "../../src/index";
import type { FixtureContext } from "./types";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const DATE_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})\b/gi;

const KEYWORD_TYPE: [RegExp, DeliverableType][] = [
  [/final\s+exam|\bfinal\b/i, "exam"],
  [/midterm|\btest\b/i, "exam"],
  [/\bexam\b/i, "exam"],
  [/quiz(?:zes)?/i, "quiz"],
  [/assignment/i, "assignment"],
  [/\blab\b/i, "other"],
  [/project/i, "project"],
  [/presentation/i, "presentation"],
  [/essay|paper|report/i, "assignment"],
];

const pad = (n: number): string => String(n).padStart(2, "0");

function toIso(month: number, day: number, ctx: FixtureContext): string {
  const years = [Number(ctx.semesterStart.slice(0, 4)), Number(ctx.semesterEnd.slice(0, 4))];
  for (const y of new Set(years)) {
    const iso = `${y}-${pad(month)}-${pad(day)}`;
    if (iso >= ctx.semesterStart && iso <= ctx.semesterEnd) return iso;
  }
  return `${years[0]}-${pad(month)}-${pad(day)}`;
}

function classify(ctx: string): { type: DeliverableType; title: string } | null {
  for (const [re, type] of KEYWORD_TYPE) {
    const m = ctx.match(re);
    if (m) {
      // Pull a trailing number after the keyword for a title like "Assignment 1".
      const after = ctx.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 4);
      const num = after.match(/\s*(\d{1,2})/);
      const word = m[0].trim();
      const title = num ? `${cap(word)} ${num[1]}` : cap(word);
      return { type, title };
    }
  }
  return null;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export function regexBaseline(text: string, ctx: FixtureContext): ParseResult {
  const deliverables: Deliverable[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(DATE_RE)) {
    const monthKey = m[1]?.slice(0, m[1].startsWith("sept") ? 4 : 3).toLowerCase() ?? "";
    const month = MONTHS[monthKey];
    const day = Number(m[2]);
    if (!month || day < 1 || day > 31) continue;

    const at = m.index ?? 0;
    const before = text.slice(Math.max(0, at - 80), at);
    const found = classify(before);
    if (!found) continue;

    const due_date = toIso(month, day, ctx);
    const weightMatch = before.match(/(\d+(?:\.\d+)?)\s*%/g);
    const last = weightMatch?.at(-1);
    const weight_percent = last ? Number(last.replace("%", "")) : null;

    const dedupe = `${found.title}|${due_date}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    deliverables.push({
      title: found.title,
      type: found.type,
      due_date,
      due_time: null,
      weight_percent,
      notes: null,
      recurrence: null,
      confidence: "low",
      ambiguity_reason: "regex baseline",
    });
  }

  return {
    course: {
      name: text.slice(0, 60).replace(/\s+/g, " ").trim(),
      code: text.match(/\b([A-Z]{2,}\s?\d{4}[A-Z]?)\b/)?.[1] ?? null,
      instructor: null,
      semester_start: ctx.semesterStart,
      semester_end: ctx.semesterEnd,
    },
    deliverables,
  };
}
