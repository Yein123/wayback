import { describe, expect, it } from "vitest";
import { flatten, metresPerPixel, polygonArea, toMetres, unflatten } from "@/lib/outline";

describe("metresPerPixel", () => {
  it("is the real distance over the plan distance", () => {
    expect(metresPerPixel([0, 0], [300, 400], 25)).toBeCloseTo(0.05);
  });

  it("refuses a zero-length line or distance", () => {
    expect(metresPerPixel([5, 5], [5, 5], 10)).toBeNull();
    expect(metresPerPixel([0, 0], [10, 0], 0)).toBeNull();
  });
});

describe("polygonArea", () => {
  it("measures a rectangle either way round", () => {
    const rect: [number, number][] = [
      [0, 0],
      [40, 0],
      [40, 20],
      [0, 20],
    ];
    expect(polygonArea(rect)).toBe(800);
    expect(polygonArea([...rect].reverse())).toBe(800);
  });
});

describe("toMetres", () => {
  it("measures from the plan's centre", () => {
    expect(toMetres([500, 300], { width: 1000, height: 600 }, 0.1)).toEqual([0, 0]);
    expect(toMetres([1000, 600], { width: 1000, height: 600 }, 0.1)).toEqual([50, 30]);
  });
});

describe("flatten / unflatten", () => {
  it("round-trips points for storage", () => {
    const pts: [number, number][] = [
      [1.04, 2],
      [3, 4.55],
    ];
    expect(unflatten(flatten(pts))).toEqual([
      [1, 2],
      [3, 4.6],
    ]);
  });
});
