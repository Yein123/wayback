import { describe, expect, it } from "vitest";
import { classify, convexHull, detectShapes, simplify } from "@/lib/detect";

/** A tiny plan: dark background, a light walkway band, two grey shops split by a walkway line, one blue lift. */
function plan() {
  const w = 60;
  const h = 40;
  const data = new Array(w * h * 4).fill(0);
  const paint = (x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number]) => {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        [data[i], data[i + 1], data[i + 2], data[i + 3]] = [...rgb, 255];
      }
  };
  paint(0, 0, w, h, [20, 20, 24]); // background
  paint(5, 5, 55, 35, [230, 230, 235]); // walkway
  paint(8, 8, 25, 20, [150, 150, 155]); // shop A
  paint(26, 8, 45, 20, [150, 150, 155]); // shop B (one walkway pixel from A)
  paint(10, 25, 16, 31, [110, 140, 210]); // lift
  return { data, width: w, height: h };
}

describe("classify", () => {
  it("sorts flat plan colours", () => {
    expect(classify(20, 20, 24)).toBe(0);
    expect(classify(230, 230, 235)).toBe(1);
    expect(classify(150, 150, 155)).toBe(2);
    expect(classify(110, 60, 40)).toBe(2); // brown anchor store
    expect(classify(110, 140, 210)).toBe(3);
  });
});

describe("detectShapes", () => {
  it("finds each shop and the lift as separate shapes", () => {
    const shapes = detectShapes(plan(), 1, 0.001);
    expect(shapes.filter((s) => s.kind === "room")).toHaveLength(2);
    expect(shapes.filter((s) => s.kind === "lift")).toHaveLength(1);
  });

  it("scales points back to the full plan", () => {
    const shapes = detectShapes(plan(), 4, 0.001);
    const xs = shapes.flatMap((s) => s.points.map((p) => p[0]));
    expect(Math.max(...xs)).toBeGreaterThan(150);
  });
});

describe("convexHull / simplify", () => {
  it("wraps a square with an inside point", () => {
    const hull = convexHull([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [5, 5],
    ]);
    expect(hull).toHaveLength(4);
  });

  it("drops corners lying on a straight edge", () => {
    expect(
      simplify(
        [
          [0, 0],
          [5, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        0.5,
      ),
    ).toHaveLength(4);
  });
});
