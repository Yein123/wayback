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
    // upper cubes are stairs 2 and 3, each stacked right on top of the lower cube of stair 1 or 4
    for (const c of all) expect(c.half > 0).toBe(c.stair === 2 || c.stair === 3);
    const at = (stair: number) => all.find((c) => c.hallway === "SE" && c.side === "left" && c.stair === stair)!.center;
    expect(at(1)).toEqual(at(2));
    expect(at(4)).toEqual(at(3));
    expect(at(1)).not.toEqual(at(4));
  });

  it("puts the demo cube on the left of SE stair 2, half a flight above floor 5", () => {
    const cube = cubes().find((c) => c.hallway === "SE" && c.stair === 2 && c.side === "left")!;
    const spot = getSpot("cube-f6-25")!;
    // the cube spot is just inside its entry gap, and F6-26 is room 3 on the plan (the middle door)
    const near = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    expect(near(spot.pos, cubePoint(cube, CUBE_ENTRY_X, 0.6))).toBeLessThan(0.2);
    expect(near(getSpot("room-f6-26")!.pos, cubePoint(cube, -1.63, 5.05))).toBeLessThan(0.2);
    expect(spotLevel(spot)).toBe(floorLevel("5") + cube.half);
    expect(near(cube.door, getSpot("se-stair-2")!.pos)).toBeLessThan(0.2);
  });

  it("alternates the stairs: facing a stack, stairs 1 and 3 come in on the left, 2 and 4 on the right", () => {
    // which side of "walking in" a plan point lands on: > 0 is your right (map y points south)
    const sideOf = (c: Cube, x: number) => {
      const [px, py] = cubePoint(c, x, 1);
      const [fx, fy] = c.inward;
      const [ox, oy] = cubePoint(c, 0, 0);
      return fx * (py - oy) - fy * (px - ox);
    };
    for (const c of cubes()) {
      // the stair arrives at the entry gap: on your right for stairs 2 and 4, your left for 1 and 3
      const right = sideOf(c, CUBE_ENTRY_X) > 0;
      expect(right, `${c.hallway} ${c.side} stair ${c.stair}`).toBe(c.stair === 2 || c.stair === 4);
      // and it runs straight in from the hallway, not at a slant
      const entry = cubePoint(c, CUBE_ENTRY_X, 0);
      const [dx, dy] = [entry[0] - c.door[0], entry[1] - c.door[1]];
      expect(Math.abs(dx * c.inward[1] - dy * c.inward[0])).toBeLessThan(1e-9);
    }
  });

  it("swaps the toilet and the stairs between the cube's two floors", () => {
    const at = (floor: 1 | 2, kind: string) => cubePlan(floor).find((p) => p.kind === kind)!.x;
    expect(at(1, "toilet")).toEqual(at(2, "stairs"));
    expect(at(1, "stairs")).toEqual(at(2, "toilet"));
    // the hallway stair arrives in the open corner past the inner stairs, just above the end room
    const room1 = cubePlan(1).find((p) => p.room === 1)!;
    expect(CUBE_ENTRY_X).toBeGreaterThan(at(1, "stairs")[1]);
    expect(CUBE_ENTRY_X).toBeLessThan(6);
    expect(room1.x[0]).toBeLessThan(CUBE_ENTRY_X);
    // with a walkway between the top of the stair and the rooms
    expect(room1.d[0]).toBeGreaterThan(2);
  });

  it("mirrors the SE hallway into the other three", () => {
    const [x, y] = hallwayPath("SE")[2];
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
    expect(hallwayPath("NW")[2]).toEqual([-x, -y]);
    expect(hallwayPath("NE")[2]).toEqual([x, -y]);
    expect(hallwayPath("SW")[2]).toEqual([-x, y]);
  });
});
