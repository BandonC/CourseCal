// Loads packages/syllabus-parser/.env (when present) for tests/evals that make a
// live LLM call. No-op when the file is absent. See DECISIONS.md (2026-06-12).
import { config } from "dotenv";

config();
