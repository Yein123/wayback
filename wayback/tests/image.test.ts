import { describe, expect, it } from "vitest";
import { detailScore, PLAIN_WALL } from "@/lib/image";

describe("detailScore", () => {
  const picture = (f: (x: number, y: number) => number, w = 64, h = 80) =>
    detailScore(Array.from({ length: w * h }, (_, i) => f(i % w, Math.floor(i / w))), w, h);

  it("calls an even wall plain, even with a soft shadow across it", () => {
    expect(picture(() => 200)).toBe(0);
    expect(picture((x, y) => 180 + y * 0.3)).toBeLessThan(PLAIN_WALL);
  });

  it("sees a sign board or a stair edge as detail", () => {
    // dark text-like blocks on a light board, and stair treads every 6 px
    expect(picture((x, y) => (x % 8 < 3 && y % 10 < 4 ? 40 : 220))).toBeGreaterThan(PLAIN_WALL);
    expect(picture((x, y) => (y % 6 === 0 ? 60 : 170))).toBeGreaterThan(PLAIN_WALL);
  });
});

