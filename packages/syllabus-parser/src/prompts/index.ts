// Re-exports the active prompt version. Bumping to the next version = change these imports.
export {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  renderUserContent,
  buildPrompt,
} from "./v2";
export type { PromptContext } from "./v2";
