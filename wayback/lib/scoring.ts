// Pure scoring helpers for the Location Matcher (tested in tests/scoring.test.ts).

export type ReferenceEmbedding = { file: string; spotId: string; vector: number[] };

export type SpotGuess = {
  spotId: string;
  score: number;
  /** The reference photo of this spot that matched best. */
  file: string;
};

/** How closely two vectors point the same way: 1 = identical direction, 0 = unrelated. */
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Score every spot by its best-matching reference photo, highest first. */
export function rankSpots(query: ArrayLike<number>, references: ReferenceEmbedding[]): SpotGuess[] {
  const best = new Map<string, SpotGuess>();
  for (const ref of references) {
    const score = cosineSimilarity(query, ref.vector);
    const current = best.get(ref.spotId);
    if (!current || score > current.score) {
      best.set(ref.spotId, { spotId: ref.spotId, score, file: ref.file });
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

/**
 * Four-side capture: a spot's score is the average of its scores across all the photos, so it has to
 * look right from several directions rather than win on one lucky match. Its photo is its best match.
 */
export function combineSides(perPhoto: SpotGuess[][]): SpotGuess[] {
  if (perPhoto.length === 1) return perPhoto[0];
  const totals = new Map<string, { sum: number; best: SpotGuess }>();
  for (const guesses of perPhoto) {
    for (const g of guesses) {
      const t = totals.get(g.spotId);
      if (!t) totals.set(g.spotId, { sum: g.score, best: g });
      else {
        t.sum += g.score;
        if (g.score > t.best.score) t.best = g;
      }
    }
  }
  return [...totals.values()]
    .map(({ sum, best }) => ({ spotId: best.spotId, file: best.file, score: sum / perPhoto.length }))
    .sort((a, b) => b.score - a.score);
}

/**
 * The GPS pin: with an accurate fix (in map metres), drop spots that are too far away to be where you are.
 * A poor or missing fix changes nothing, and it never drops every spot. GPS can't tell floors, so only
 * the position on the floor plan is compared.
 */
export function nearGps(
  guesses: SpotGuess[],
  here: { x: number; y: number; accuracy: number } | null,
  posOf: (spotId: string) => [number, number] | undefined,
  { maxAccuracy = 20, margin = 15 } = {},
): SpotGuess[] {
  if (!here || here.accuracy > maxAccuracy) return guesses;
  const reach = here.accuracy + margin;
  const kept = guesses.filter((g) => {
    const p = posOf(g.spotId);
    return !p || Math.hypot(p[0] - here.x, p[1] - here.y) <= reach;
  });
  return kept.length ? kept : guesses;
}
