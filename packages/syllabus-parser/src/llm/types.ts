import { type Result } from "../result";
import { type ToolDefinition } from "./extraction";

export type LlmRequest = {
  model: string;
  maxTokens: number;
  system: string;
  user: string;
  tool: ToolDefinition;
};

export type LlmError = { message: string };

/**
 * The library's single external-effect seam (COURSECAL.md §8.1). An implementation
 * calls the model, forces the tool, and returns its raw input object — the caller
 * validates it against the extraction schema. This is also the test stub and the
 * eval record/replay point; no multi-provider scaffolding ships in v1 (§2.2).
 */
export interface LLMClient {
  extract(req: LlmRequest): Promise<Result<unknown, LlmError>>;
}
