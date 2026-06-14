// parseSyllabus — the library's public entry point (COURSECAL.md §8.1).
// Pipeline: guard input → assemble prompt → (dryRun short-circuit) → call the LLM
// seam → validate the extraction → resolve dates → validate the public result.
// Returns a Result; throws only on genuine programmer bugs.

import {
  DEFAULT_MAX_TOKENS,
  MAX_SYLLABUS_CHARS,
  resolveModel,
} from "./constants";
import { type DateResolutionContext } from "./dates";
import { AnthropicLLMClient, type LLMClient } from "./llm";
import { ExtractionSchema, extractTool } from "./llm/extraction";
import { buildPrompt, type PromptContext } from "./prompts";
import { resolveExtraction } from "./resolution";
import { ParseResultSchema, type ParseResult } from "./schema";
import { type ParseError, type Result, err, ok } from "./result";

/** Public parse context. ISO date strings end-to-end (see DECISIONS.md 2026-06-13). */
export type SyllabusContext = {
  semesterStart: string; // ISO YYYY-MM-DD
  semesterEnd: string; // ISO
  today: string; // ISO
  timezone: string;
  readingWeeks?: { start: string; end: string }[];
  holidays?: string[];
};

export type ParseOptions = {
  /** Defaults to the Anthropic client (reads ANTHROPIC_API_KEY from env). */
  llmClient?: LLMClient;
  /** Return the assembled prompt without calling the model (free, fast). */
  dryRun?: boolean;
};

export type DryRunResult = {
  dryRun: true;
  version: string;
  system: string;
  user: string;
};

export function parseSyllabus(
  text: string,
  context: SyllabusContext,
  options: ParseOptions & { dryRun: true },
): Promise<Result<DryRunResult, ParseError>>;
export function parseSyllabus(
  text: string,
  context: SyllabusContext,
  options?: ParseOptions,
): Promise<Result<ParseResult, ParseError>>;
export async function parseSyllabus(
  text: string,
  context: SyllabusContext,
  options: ParseOptions = {},
): Promise<Result<ParseResult | DryRunResult, ParseError>> {
  if (text.trim().length === 0) {
    return err({ kind: "empty_input", message: "syllabus text is empty" });
  }
  if (text.length > MAX_SYLLABUS_CHARS) {
    return err({
      kind: "input_too_large",
      message: `syllabus exceeds the ${MAX_SYLLABUS_CHARS}-character limit`,
    });
  }

  const promptContext: PromptContext = {
    semesterStart: context.semesterStart,
    semesterEnd: context.semesterEnd,
    today: context.today,
    timezone: context.timezone,
    readingWeeks: context.readingWeeks,
    holidays: context.holidays,
  };
  const prompt = buildPrompt(promptContext, text);

  if (options.dryRun) {
    return ok({
      dryRun: true,
      version: prompt.version,
      system: prompt.system,
      user: prompt.user,
    });
  }

  const client = options.llmClient ?? new AnthropicLLMClient();
  const raw = await client.extract({
    model: resolveModel(),
    maxTokens: DEFAULT_MAX_TOKENS,
    system: prompt.system,
    user: prompt.user,
    tool: extractTool(),
  });
  if (!raw.ok) {
    return err({ kind: "llm_error", message: raw.error.message });
  }

  const extraction = ExtractionSchema.safeParse(raw.data);
  if (!extraction.success) {
    return err({
      kind: "invalid_response",
      message: "model output did not match the expected schema",
    });
  }

  const dateContext: DateResolutionContext = {
    semesterStart: context.semesterStart,
    semesterEnd: context.semesterEnd,
    readingWeeks: context.readingWeeks,
    holidays: context.holidays,
  };
  const resolved = resolveExtraction(extraction.data, dateContext);

  const validated = ParseResultSchema.safeParse(resolved);
  if (!validated.success) {
    return err({
      kind: "invalid_response",
      message: "resolved result failed validation",
    });
  }
  return ok(validated.data);
}
