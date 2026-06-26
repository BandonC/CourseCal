// Fixture loader. Reads evals/fixtures/<slug>/{syllabus.txt,context.json,labels.json,
// meta.json} from disk — fs lives here in the eval harness, never in src/ (purity).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Fixture, FixtureContext, FixtureMeta, Labels } from "./types";

const HERE = fileURLToPath(new URL(".", import.meta.url));
export const FIXTURES_DIR = join(HERE, "..", "fixtures");

/** Load every fixture directory, sorted by slug for stable report ordering. */
export function loadFixtures(dir: string = FIXTURES_DIR): Fixture[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((slug) => loadFixture(join(dir, slug), slug));
}

function loadFixture(path: string, slug: string): Fixture {
  const text = read(join(path, "syllabus.txt"), slug);
  const context = readJson<FixtureContext>(join(path, "context.json"), slug);
  const labels = readJson<Labels>(join(path, "labels.json"), slug);
  const meta = readJson<FixtureMeta>(join(path, "meta.json"), slug);
  return { slug, text, context, labels, meta };
}

function read(file: string, slug: string): string {
  if (!existsSync(file)) {
    throw new Error(`fixture "${slug}" is missing ${file}`);
  }
  return readFileSync(file, "utf8");
}

function readJson<T>(file: string, slug: string): T {
  return JSON.parse(read(file, slug)) as T;
}
