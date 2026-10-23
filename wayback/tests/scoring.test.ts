import { describe, expect, it } from "vitest";
import { cosineSimilarity, rankSpots } from "@/lib/scoring";

describe("cosineSimilarity", () => {
  it("is 1 for the same direction and 0 for unrelated vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("is 0 when a vector is all zeros", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe("rankSpots", () => {
  const refs = [
    { file: "a1.jpg", spotId: "a", vector: [1, 0, 0] },
    { file: "a2.jpg", spotId: "a", vector: [0.6, 0.8, 0] },
    { file: "b1.jpg", spotId: "b", vector: [0, 1, 0] },
    { file: "c1.jpg", spotId: "c", vector: [0, 0, 1] },
  ];

  it("returns one guess per spot, best first", () => {
    const ranked = rankSpots([0.5, 1, 0], refs);
    expect(ranked.map((g) => g.spotId)).toEqual(["a", "b", "c"]);
  });

  it("uses the spot's best-matching photo", () => {
    const [top] = rankSpots([0.5, 1, 0], refs);
    expect(top.file).toBe("a2.jpg");
  });
});
