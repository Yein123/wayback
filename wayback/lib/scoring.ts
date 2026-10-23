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
