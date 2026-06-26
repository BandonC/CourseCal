// Report builder: turns per-fixture scores into aggregate + per-stratum metrics and
// writes report.json (full dump) and report.md (the human-readable scorecard with the
// baseline lift comparison and the failure analysis). Pure string/JSON assembly; the
// caller owns running the parser/baseline and passing the scored results in.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Counts, Failure, FixtureScore } from "./score";
import { addCounts, emptyCounts } from "./score";
import type { FixtureMeta } from "./types";

const HERE = fileURLToPath(new URL(".", import.meta.url));
export const REPORT_DIR = join(HERE, "..", "report");

export type Metrics = {
  recall: number;
  precision: number;
  typeAccuracy: number;
  explicitDateAccuracy: number;
  explicitDateWithin1: number;
  relativeDateAccuracy: number;
  weightAccuracy: number;
  recurrenceAccuracy: number;
};

const ratio = (n: number, d: number): number => (d === 0 ? 0 : n / d);

export function metrics(c: Counts): Metrics {
  return {
    recall: ratio(c.matched, c.labels),
    precision: ratio(c.matched, c.predicted),
    typeAccuracy: ratio(c.typeMatched, c.matched),
    explicitDateAccuracy: ratio(c.explicitExact, c.explicitTotal),
    explicitDateWithin1: ratio(c.explicitWithin1, c.explicitTotal),
    relativeDateAccuracy: ratio(c.relativeExact, c.relativeTotal),
    weightAccuracy: ratio(c.weightExact, c.weightTotal),
    recurrenceAccuracy: ratio(c.recurrenceDetected, c.recurrenceTotal),
  };
}

export function aggregate(scores: FixtureScore[]): Counts {
  return scores.reduce((acc, s) => addCounts(acc, s.counts), emptyCounts());
}

function bucketRows<T extends { counts: Counts }>(
  rows: T[],
  key: (s: T) => string,
): Map<string, Counts> {
  const out = new Map<string, Counts>();
  for (const s of rows) {
    const k = key(s);
    out.set(k, addCounts(out.get(k) ?? emptyCounts(), s.counts));
  }
  return new Map([...out.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export type SystemRun = { name: string; scores: FixtureScore[] };

export type Report = {
  generatedAt: string;
  model: string;
  promptVersion: string;
  systems: {
    name: string;
    overall: { counts: Counts; metrics: Metrics };
    perFixture: { slug: string; meta: FixtureMeta; counts: Counts; metrics: Metrics; failures: Failure[] }[];
  }[];
};

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

export function buildReport(
  parser: SystemRun,
  baseline: SystemRun | null,
  model: string,
  promptVersion: string,
): Report {
  const systems = [parser, ...(baseline ? [baseline] : [])].map((sys) => ({
    name: sys.name,
    overall: { counts: aggregate(sys.scores), metrics: metrics(aggregate(sys.scores)) },
    perFixture: sys.scores.map((s) => ({
      slug: s.slug,
      meta: s.meta,
      counts: s.counts,
      metrics: metrics(s.counts),
      failures: s.failures,
    })),
  }));
  return {
    generatedAt: new Date().toISOString(),
    model,
    promptVersion,
    systems,
  };
}

function headlineTable(report: Report): string {
  const head =
    "| System | Recall | Precision | Type | Explicit date | Explicit ±1 | Relative date | Weight | Recurrence |\n" +
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |";
  const rows = report.systems.map((s) => {
    const m = s.overall.metrics;
    return `| ${s.name} | ${pct(m.recall)} | ${pct(m.precision)} | ${pct(m.typeAccuracy)} | ${pct(m.explicitDateAccuracy)} | ${pct(m.explicitDateWithin1)} | ${pct(m.relativeDateAccuracy)} | ${pct(m.weightAccuracy)} | ${pct(m.recurrenceAccuracy)} |`;
  });
  return [head, ...rows].join("\n");
}

type FixtureRow = { meta: FixtureMeta; counts: Counts };

function strataTable(rows: FixtureRow[]): string {
  const axes: [string, (s: FixtureRow) => string][] = [
    ["format", (s) => s.meta.format],
    ["discipline", (s) => s.meta.discipline],
    ["recurrence", (s) => s.meta.recurrence],
  ];
  const lines = ["| Stratum | n (deliv) | Recall | Precision | Explicit date |", "| --- | --- | --- | --- | --- |"];
  for (const [axis, key] of axes) {
    for (const [val, counts] of bucketRows(rows, key)) {
      const m = metrics(counts);
      lines.push(`| ${axis}: ${val} | ${counts.labels} | ${pct(m.recall)} | ${pct(m.precision)} | ${pct(m.explicitDateAccuracy)} |`);
    }
  }
  return lines.join("\n");
}

function perFixtureTable(sys: Report["systems"][number]): string {
  const lines = ["| Fixture | Labels | Predicted | Matched | Recall | Explicit date |", "| --- | --- | --- | --- | --- | --- |"];
  for (const f of sys.perFixture) {
    lines.push(
      `| ${f.slug} | ${f.counts.labels} | ${f.counts.predicted} | ${f.counts.matched} | ${pct(f.metrics.recall)} | ${pct(f.metrics.explicitDateAccuracy)} |`,
    );
  }
  return lines.join("\n");
}

function failureAnalysis(sys: Report["systems"][number]): string {
  const byKind = new Map<string, string[]>();
  for (const f of sys.perFixture) {
    for (const fail of f.failures) {
      const list = byKind.get(fail.kind) ?? [];
      list.push(`${f.slug} — ${fail.detail}`);
      byKind.set(fail.kind, list);
    }
  }
  if (byKind.size === 0) return "_No failures._";
  const order = [
    "missed",
    "hallucinated",
    "wrong_type",
    "wrong_date_explicit",
    "wrong_date_relative",
    "wrong_weight",
    "wrong_recurrence",
  ];
  const sections: string[] = [];
  for (const kind of order) {
    const list = byKind.get(kind);
    if (!list || list.length === 0) continue;
    sections.push(`**${kind}** (${list.length})\n` + list.map((l) => `- ${l}`).join("\n"));
  }
  return sections.join("\n\n");
}

export function renderMarkdown(report: Report): string {
  const parser = report.systems[0];
  if (!parser) return "# Eval report\n\n_No results._\n";
  return [
    "# Eval report",
    "",
    `Generated ${report.generatedAt} · model \`${report.model}\` · prompt \`${report.promptVersion}\`.`,
    "",
    "## Headline (overall)",
    "",
    headlineTable(report),
    "",
    "## By stratum (parser)",
    "",
    strataTable(parser.perFixture),
    "",
    "## Per fixture (parser)",
    "",
    perFixtureTable(parser),
    "",
    "## Failure analysis (parser)",
    "",
    failureAnalysis(parser),
    "",
  ].join("\n");
}

export function writeReport(report: Report, dir: string = REPORT_DIR): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(dir, "report.md"), renderMarkdown(report));
}
