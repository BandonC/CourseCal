// Record/replay LLM client — the eval's determinism + cost control (COURSECAL §12.1,
// §13.2). Wraps the real Anthropic client behind the library's LLMClient seam and
// caches each model response on disk, keyed on the fields that determine the output.
//
// record: call the API only on a cache miss, then persist the response.
// replay: serve from cache; a miss is a hard error — re-scoring never spends tokens.
//
// A new prompt version changes the key → forces a re-record. That is the protocol:
// a changed prompt must be re-run, not silently scored against stale responses.

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AnthropicLLMClient } from "../../src/index";
import type { LLMClient, LlmError, LlmRequest, Result } from "../../src/index";

const HERE = fileURLToPath(new URL(".", import.meta.url));
export const CACHE_DIR = join(HERE, "..", "cache");

export type Mode = "record" | "replay";

/** Stable cache key over only the request fields that determine the model's output. */
export function cacheKey(req: LlmRequest): string {
  const canonical = JSON.stringify({
    model: req.model,
    system: req.system,
    user: req.user,
    tool: { name: req.tool.name, inputSchema: req.tool.inputSchema },
  });
  return createHash("sha256").update(canonical).digest("hex");
}

type CacheEntry = {
  key: string;
  model: string;
  recordedAt: string;
  /** The model's raw tool-input object — exactly what LLMClient.extract returns. */
  data: unknown;
};

export class RecordReplayLLMClient implements LLMClient {
  private readonly inner: LLMClient;

  constructor(
    private readonly mode: Mode,
    private readonly cacheDir: string = CACHE_DIR,
    inner?: LLMClient,
  ) {
    this.inner = inner ?? new AnthropicLLMClient();
    if (this.mode === "record" && !existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  async extract(req: LlmRequest): Promise<Result<unknown, LlmError>> {
    const key = cacheKey(req);
    const path = join(this.cacheDir, `${key}.json`);

    if (existsSync(path)) {
      const entry = JSON.parse(readFileSync(path, "utf8")) as CacheEntry;
      return { ok: true, data: entry.data };
    }

    if (this.mode === "replay") {
      return {
        ok: false,
        error: {
          message: `cache miss in replay mode (key ${key.slice(0, 12)}…) — run eval:record first`,
        },
      };
    }

    const result = await this.inner.extract(req);
    if (result.ok) {
      const entry: CacheEntry = {
        key,
        model: req.model,
        recordedAt: new Date().toISOString(),
        data: result.data,
      };
      writeFileSync(path, `${JSON.stringify(entry, null, 2)}\n`);
    }
    return result;
  }
}
