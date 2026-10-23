import { describe, expect, it } from "vitest";
import { cubes, FLOORS, floorLevel, hallwayPath, levelName } from "@/lib/building";
import { getSpot, spotLevel } from "@/lib/map";

describe("building", () => {
  it("stacks every floor once, B2 at the bottom", () => {
    const levels = FLOORS.map(floorLevel);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(new Set(levels).size).toBe(FLOORS.length);
    expect(levelName(floorLevel("B2"))).toBe("B2");
    expect(levelName(floorLevel("6"))).toBe("FLOOR 6");
  });

  it("has 32 cubes per floor, half up and half down", () => {
    const all = cubes();
    expect(all).toHaveLength(32);
    expect(all.filter((c) => c.half > 0)).toHaveLength(16);
    // upper cubes are stairs 2 and 3, and sit further from the hallway
    for (const c of all) expect(c.half > 0).toBe(c.stair === 2 || c.stair === 3);
  });

  it("puts the demo cube on the left of SE stair 2, half a flight above floor 5", () => {
    const cube = cubes().find((c) => c.hallway === "SE" && c.stair === 2 && c.side === "left")!;
    const spot = getSpot("cube-f6-25")!;
    expect(Math.hypot(cube.center[0] - spot.pos[0], cube.center[1] - spot.pos[1])).toBeLessThan(1.5);
    expect(spotLevel(spot)).toBe(floorLevel("5") + cube.half);
    expect(cube.door).toEqual(getSpot("se-stair-2")!.pos);
  });

  it("mirrors the SE hallway into the other three", () => {
    expect(hallwayPath("SE")[2]).toEqual([27, 21]);
    expect(hallwayPath("NW")[2]).toEqual([-27, -21]);
    expect(hallwayPath("NE")[2]).toEqual([27, -21]);
  });
});
