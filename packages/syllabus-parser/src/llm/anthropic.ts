import Anthropic from "@anthropic-ai/sdk";
import { type Result, ok, err } from "../result";
import { type LLMClient, type LlmError, type LlmRequest } from "./types";

/**
 * Anthropic implementation of the LLM seam. Forces the extract tool and returns
 * its input block. Never puts prompt or syllabus content in an error message
 * (CLAUDE.md security rules); the SDK's own error text is API-level, not content.
 */
export class AnthropicLLMClient implements LLMClient {
  private readonly client: Anthropic;

  /** Default client reads ANTHROPIC_API_KEY from the environment. */
  constructor(client?: Anthropic) {
    this.client = client ?? new Anthropic();
  }

  async extract(req: LlmRequest): Promise<Result<unknown, LlmError>> {
    try {
      const response = await this.client.messages.create({
        model: req.model,
        max_tokens: req.maxTokens,
        // System is the stable, cacheable prefix; tools render before it, so this
        // breakpoint caches tools + system across repeated parses.
        system: [
          {
            type: "text",
            text: req.system,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [
          {
            name: req.tool.name,
            description: req.tool.description,
            input_schema: req.tool.inputSchema as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: req.tool.name },
        messages: [{ role: "user", content: req.user }],
      });

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );
      if (!toolUse) {
        return err({ message: "model did not return a tool call" });
      }
      return ok(toolUse.input);
    } catch (e) {
      return err({ message: describeError(e) });
    }
  }
}

function describeError(e: unknown): string {
  if (e instanceof Anthropic.APIError) {
    return `Anthropic API error (status ${e.status ?? "unknown"})`;
  }
  return "Anthropic request failed";
}
