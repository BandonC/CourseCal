// Re-exports the active prompt version. Bumping to v2 = change these imports.
export {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  renderUserContent,
  buildPrompt,
} from "./v1";
export type { PromptContext } from "./v1";
