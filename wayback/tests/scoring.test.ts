import { describe, expect, it } from "vitest";
import { combineSides, cosineSimilarity, nearGps, rankSpots } from "@/lib/scoring";

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

describe("combineSides", () => {
  it("prefers the spot that matches most sides over one lucky photo", () => {
    const side = (a: number, b: number) => [
      { spotId: "a", score: a, file: "a.jpg" },
      { spotId: "b", score: b, file: "b.jpg" },
    ];
    // b wins one photo by a lot, a wins the other three
    const ranked = combineSides([side(0.8, 0.6), side(0.8, 0.6), side(0.8, 0.6), side(0.5, 0.95)]);
    expect(ranked[0].spotId).toBe("a");
    expect(ranked[0].score).toBeCloseTo((0.8 * 3 + 0.5) / 4);
  });

  it("keeps a single photo's ranking as it is", () => {
    const one = [{ spotId: "x", score: 0.7, file: "x.jpg" }];
    expect(combineSides([one])).toBe(one);
  });
});

describe("nearGps", () => {
  const guesses = [
    { spotId: "far", score: 0.9, file: "f.jpg" },
    { spotId: "near", score: 0.8, file: "n.jpg" },
  ];
  const pos = (id: string): [number, number] | undefined => (id === "far" ? [100, 0] : id === "near" ? [5, 0] : undefined);

  it("drops spots far from an accurate fix", () => {
    expect(nearGps(guesses, { x: 0, y: 0, accuracy: 8 }, pos).map((g) => g.spotId)).toEqual(["near"]);
  });

  it("changes nothing with a poor fix or no fix", () => {
    expect(nearGps(guesses, { x: 0, y: 0, accuracy: 60 }, pos)).toEqual(guesses);
    expect(nearGps(guesses, null, pos)).toEqual(guesses);
  });

  it("lets a rough fix settle a close call, but not overrule a clear match", () => {
    const close = [
      { spotId: "far", score: 0.8, file: "f.jpg" },
      { spotId: "near", score: 0.79, file: "n.jpg" },
    ];
    expect(nearGps(close, { x: 0, y: 0, accuracy: 28 }, pos)[0].spotId).toBe("near");
    expect(nearGps(guesses, { x: 0, y: 0, accuracy: 28 }, pos)[0].spotId).toBe("far");
  });

  it("never drops every spot", () => {
    expect(nearGps(guesses, { x: 500, y: 500, accuracy: 5 }, pos)).toEqual(guesses);
  });
});
