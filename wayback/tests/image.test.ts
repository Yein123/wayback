import { describe, expect, it } from "vitest";
import { detailScore, PLAIN_WALL, stretchGray } from "@/lib/image";

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

describe("stretchGray", () => {
  it("turns a dim, low-contrast photo grey and full range", () => {
    // 100 pixels from rgb(100,100,100) to rgb(140,140,140): a washed-out sign under a tube light
    const px = new Uint8ClampedArray(400);
    for (let i = 0; i < 100; i++) px.set([100 + Math.round((i * 40) / 99), 100 + Math.round((i * 40) / 99), 100 + Math.round((i * 40) / 99), 255], i * 4);
    stretchGray(px);
    expect(px[0]).toBe(0);
    expect(px[99 * 4]).toBe(255);
    expect(px[50 * 4]).toBeGreaterThan(100);
    expect(px[50 * 4]).toBeLessThan(155);
    expect(px[50 * 4 + 1]).toBe(px[50 * 4]);
    expect(px[50 * 4 + 3]).toBe(255);
  });
});
