// Eval orchestrator. Modes (one CLI flag):
//   --record    parse every fixture, calling Anthropic on cache misses (spends tokens)
//   --replay    parse from the committed cache only — deterministic, no API calls
//   --baseline  run only the regex baseline (never touches the LLM)
//   --check     replay, then exit non-zero on any cache miss or a metric below its
//               floor — the CI gate (no API key, no spend; see .github/workflows/evals.yml)
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

type Cli = Mode | "baseline" | "check";

// Gate floors for --check, set a few points under the recorded baseline (recall
// 98.6 / precision 90.7 / explicit-date 100.0, prompt v1) so real regressions trip
// but scoring noise doesn't. Relative-date is deliberately not gated: the corpus has
// no resolvable single relative-date labels (0/0 renders as 0%), so there is no
// meaningful floor — relative-date resolution is covered by the property-based tests,
// not this eval.
const FLOORS: Partial<Record<keyof ReturnType<typeof metrics>, number>> = {
  recall: 0.95,
  precision: 0.85,
  explicitDateAccuracy: 0.95,
};

function parseMode(argv: string[]): Cli {
  if (argv.includes("--record")) return "record";
  if (argv.includes("--replay")) return "replay";
  if (argv.includes("--baseline")) return "baseline";
  if (argv.includes("--check")) return "check";
  console.error("usage: run.ts --record | --replay | --baseline | --check");
  process.exit(1);
}

// The CI gate: fail the process on any replay cache miss (a changed prompt/model
// invalidates the cache → re-record) or a headline metric below its floor.
function enforceGate(parserScores: FixtureScore[] | null, misses: number): void {
  const problems: string[] = [];
  if (!parserScores) {
    problems.push("no parser scores — --check must run in replay mode");
  } else {
    if (misses > 0) {
      problems.push(
        `${misses} replay cache miss(es) — the committed cache doesn't cover every fixture. ` +
          "Run `pnpm eval:record` and commit the refreshed cache.",
      );
    }
    const m = metrics(aggregate(parserScores));
    for (const [key, floor] of Object.entries(FLOORS)) {
      const value = m[key as keyof typeof m];
      if (value < floor) {
        problems.push(
          `${key} ${(value * 100).toFixed(1)}% below floor ${(floor * 100).toFixed(1)}%`,
        );
      }
    }
  }
  if (problems.length > 0) {
    console.error("\nEval gate FAILED:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log("\nEval gate passed.");
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

async function runParser(
  fixtures: Fixture[],
  mode: Mode,
): Promise<{ scores: FixtureScore[]; misses: number }> {
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
  return { scores, misses: client.misses };
}

function runBaseline(fixtures: Fixture[]): FixtureScore[] {
  return fixtures.map((f) => scoreFixture(f, regexBaseline(f.text, f.context)));
}

async function main(): Promise<void> {
  const cli = parseMode(process.argv.slice(2));
  // --check is a replay run with assertions layered on top.
  const runMode: Mode | "baseline" = cli === "check" ? "replay" : cli;

  if (runMode === "record") {
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
  console.log(`Loaded ${fixtures.length} fixtures. Mode: ${cli}.`);

  let parserScores: FixtureScore[] | null = null;
  let misses = 0;
  if (runMode !== "baseline") {
    console.log("Running parser…");
    const run = await runParser(fixtures, runMode);
    parserScores = run.scores;
    misses = run.misses;
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

  if (cli === "check") {
    enforceGate(parserScores, misses);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
