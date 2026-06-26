// Eval orchestrator. Modes (one CLI flag):
//   --record    parse every fixture, calling Anthropic on cache misses (spends tokens)
//   --replay    parse from the committed cache only — deterministic, no API calls
//   --baseline  run only the regex baseline (never touches the LLM)
// record/replay also run the baseline so the report always carries the lift comparison.

import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parseSyllabus, type ParseResult, type SyllabusContext } from "../src/index";
import { resolveModel } from "../src/constants";
import { PROMPT_VERSION } from "../src/prompts";
import { loadFixtures } from "./harness/load";
import { RecordReplayLLMClient, type Mode } from "./harness/record-replay";
import { regexBaseline } from "./harness/baseline";
import { scoreFixture, type FixtureScore } from "./harness/score";
import { buildReport, writeReport, metrics, aggregate } from "./harness/report";
import type { Fixture } from "./harness/types";

const HERE = fileURLToPath(new URL(".", import.meta.url));

function parseMode(argv: string[]): Mode | "baseline" {
  if (argv.includes("--record")) return "record";
  if (argv.includes("--replay")) return "replay";
  if (argv.includes("--baseline")) return "baseline";
  console.error("usage: run.ts --record | --replay | --baseline");
  process.exit(1);
}

const EMPTY = (ctx: SyllabusContext): ParseResult => ({
  course: {
    name: "",
    code: null,
    instructor: null,
    semester_start: ctx.semesterStart,
    semester_end: ctx.semesterEnd,
  },
  deliverables: [],
});

async function runParser(fixtures: Fixture[], mode: Mode): Promise<FixtureScore[]> {
  const client = new RecordReplayLLMClient(mode);
  const scores: FixtureScore[] = [];
  for (const f of fixtures) {
    const result = await parseSyllabus(f.text, f.context, { llmClient: client });
    if (!result.ok) {
      console.warn(`  ${f.slug}: parse failed (${result.error.kind}: ${result.error.message})`);
      scores.push(scoreFixture(f, EMPTY(f.context)));
      continue;
    }
    scores.push(scoreFixture(f, result.data));
  }
  return scores;
}

function runBaseline(fixtures: Fixture[]): FixtureScore[] {
  return fixtures.map((f) => scoreFixture(f, regexBaseline(f.text, f.context)));
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  if (mode === "record") {
    loadEnv({ path: join(HERE, "..", ".env") });
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY not set — needed for --record. Add it to packages/syllabus-parser/.env");
      process.exit(1);
    }
  }

  const fixtures = loadFixtures();
  if (fixtures.length === 0) {
    console.error("no fixtures found in evals/fixtures");
    process.exit(1);
  }
  console.log(`Loaded ${fixtures.length} fixtures. Mode: ${mode}.`);

  let parserScores: FixtureScore[] | null = null;
  if (mode !== "baseline") {
    console.log("Running parser…");
    parserScores = await runParser(fixtures, mode);
  }

  console.log("Running regex baseline…");
  const baselineScores = runBaseline(fixtures);

  const report = buildReport(
    parserScores
      ? { name: `syllabus-parser ${PROMPT_VERSION}`, scores: parserScores }
      : { name: "regex baseline", scores: baselineScores },
    parserScores ? { name: "regex baseline", scores: baselineScores } : null,
    resolveModel(),
    PROMPT_VERSION,
  );
  writeReport(report);

  const headline = parserScores ?? baselineScores;
  const m = metrics(aggregate(headline));
  console.log(
    `\nDone. recall ${(m.recall * 100).toFixed(1)}%  precision ${(m.precision * 100).toFixed(1)}%  ` +
      `explicit-date ${(m.explicitDateAccuracy * 100).toFixed(1)}%`,
  );
  console.log("Report written to evals/report/report.{json,md}");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
