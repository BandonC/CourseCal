// Deliverable matching: align predicted deliverables to ground-truth labels so the
// scorer can compute recall/precision and per-pair accuracy. Greedy one-to-one on
// normalized-title similarity — no dependency, token-set Jaccard plus a substring
// rule so "Midterm" matches "Midterm Test".
//
// Number-aware blocking keeps numbered siblings distinct: if both titles carry a
// number and they differ ("Quiz 1" vs "Quiz 2", "Assignment 1" vs "Assignment 2"),
// the pair is hard-rejected regardless of word overlap. That lets the word threshold
// sit low enough (0.4) to absorb the same item titled differently ("iClicker Lecture
// Questions" vs "…Participation") without ever merging two distinct numbered items.

export const MATCH_THRESHOLD = 0.4;

function firstNumber(normalized: string): number | null {
  const m = normalized.match(/\d+/);
  return m ? Number(m[0]) : null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(s: string): Set<string> {
  const n = normalize(s);
  return new Set(n.length === 0 ? [] : n.split(" "));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Title similarity in [0,1]: exact, then substring-containment, then token Jaccard. */
export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  const numA = firstNumber(na);
  const numB = firstNumber(nb);
  if (numA !== null && numB !== null && numA !== numB) return 0;
  const j = jaccard(tokens(a), tokens(b));
  const shorter = na.length <= nb.length ? na : nb;
  if (shorter.length >= 3 && (na.includes(nb) || nb.includes(na))) {
    return Math.max(j, 0.85);
  }
  return j;
}

export type Match = { predIdx: number; labelIdx: number; score: number };
export type MatchResult = {
  matches: Match[];
  unmatchedPred: number[];
  unmatchedLabel: number[];
};

/**
 * Greedy maximum-similarity one-to-one matching. Builds every eligible pair
 * (score ≥ threshold), takes them highest-first, and assigns each predicted and
 * label index at most once. Greedy (not optimal assignment) is sufficient here:
 * titles are distinct enough that the global optimum and the greedy pick coincide.
 */
export function matchDeliverables(
  predTitles: string[],
  labelTitles: string[],
  threshold: number = MATCH_THRESHOLD,
): MatchResult {
  const pairs: Match[] = [];
  for (let p = 0; p < predTitles.length; p++) {
    const pt = predTitles[p] ?? "";
    for (let l = 0; l < labelTitles.length; l++) {
      const score = similarity(pt, labelTitles[l] ?? "");
      if (score >= threshold) pairs.push({ predIdx: p, labelIdx: l, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  const usedPred = new Set<number>();
  const usedLabel = new Set<number>();
  const matches: Match[] = [];
  for (const pair of pairs) {
    if (usedPred.has(pair.predIdx) || usedLabel.has(pair.labelIdx)) continue;
    matches.push(pair);
    usedPred.add(pair.predIdx);
    usedLabel.add(pair.labelIdx);
  }

  const unmatchedPred: number[] = [];
  for (let p = 0; p < predTitles.length; p++) if (!usedPred.has(p)) unmatchedPred.push(p);
  const unmatchedLabel: number[] = [];
  for (let l = 0; l < labelTitles.length; l++) if (!usedLabel.has(l)) unmatchedLabel.push(l);

  return { matches, unmatchedPred, unmatchedLabel };
}
