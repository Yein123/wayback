import { describe, expect, it } from "vitest";
import { CUBE_ENTRY_X, cubePlan, cubePoint, cubes, FLOORS, floorLevel, hallwayPath, levelName, type Cube } from "@/lib/building";
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
    // the cube spot is just inside its entry gap, and F6-26 is room 2 on the plan
    const near = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    expect(near(spot.pos, cubePoint(cube, CUBE_ENTRY_X, 0.6))).toBeLessThan(0.2);
    expect(near(getSpot("room-f6-26")!.pos, cubePoint(cube, 1.7, 3.85))).toBeLessThan(0.2);
    expect(spotLevel(spot)).toBe(floorLevel("5") + cube.half);
    expect(cube.door).toEqual(getSpot("se-stair-2")!.pos);
  });

  it("mirrors cubes across the hallway: stairs on your right walking into the demo cube, on your left opposite", () => {
    // which side of "walking in" a plan point lands on: > 0 is your right (map y points south)
    const sideOf = (c: Cube, x: number) => {
      const [px, py] = cubePoint(c, x, 1);
      const [fx, fy] = [c.center[0] - c.door[0], c.center[1] - c.door[1]];
      return fx * (py - c.door[1]) - fy * (px - c.door[0]);
    };
    const demo = cubes().find((c) => c.hallway === "SE" && c.stair === 2 && c.side === "left")!;
    const opposite = cubes().find((c) => c.hallway === "SE" && c.stair === 2 && c.side === "right")!;
    const stairsX = 2.7;
    expect(sideOf(demo, stairsX)).toBeGreaterThan(0);
    expect(sideOf(opposite, stairsX)).toBeLessThan(0);
  });

  it("swaps the toilet and the stairs between the cube's two floors", () => {
    const at = (floor: 1 | 2, kind: string) => cubePlan(floor).find((p) => p.kind === kind)!.x;
    expect(at(1, "toilet")).toEqual(at(2, "stairs"));
    expect(at(1, "stairs")).toEqual(at(2, "toilet"));
    // the entry gap sits between them
    expect(at(1, "toilet")[1]).toBeLessThan(CUBE_ENTRY_X);
    expect(at(1, "stairs")[0]).toBeGreaterThan(CUBE_ENTRY_X);
  });

  it("mirrors the SE hallway into the other three", () => {
    expect(hallwayPath("SE")[2]).toEqual([27, 21]);
    expect(hallwayPath("NW")[2]).toEqual([-27, -21]);
    expect(hallwayPath("NE")[2]).toEqual([27, -21]);
  });
});
