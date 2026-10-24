import { describe, expect, it } from "vitest";
import { CUBE_ENTRY_X, cubePlan, cubeParts, cubePoint, cubes, FLOORS, floorLevel, hallwayPath, levelName, roomNumber, type Cube } from "@/lib/building";
import labels from "./fixtures/survey-labels.json";
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

describe("the surveyed block (24 Oct)", () => {
  const center = (c: Cube, p: { x: [number, number]; d: [number, number] }) => cubePoint(c, (p.x[0] + p.x[1]) / 2, (p.d[0] + p.d[1]) / 2);
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  it("stops the NW and SW wings after one stack from floor 5 up", () => {
    expect(cubes("3")).toHaveLength(32);
    expect(cubes("5")).toHaveLength(24);
    expect(cubes("5").some((c) => (c.hallway === "NW" || c.hallway === "SW") && c.stair > 2)).toBe(false);
    // the NW end stair was pinned at -34.7, -26.3
    expect(dist(hallwayPath("NW", "5").at(-1)!, [-34.7, -26.3])).toBeLessThan(1);
    expect(hallwayPath("NW", "3")).toEqual(hallwayPath("NW"));
  });

  it("numbers every room the way the doors were read on floors 3 and 5", () => {
    // a few spots carry several labels from one pin, and F3-08 was typed twice; those can't say which room is which
    const pins = labels.filter((l) => l.note !== "stair");
    const unclear = (l: (typeof pins)[number]) => pins.some((m) => m !== l && (m.pos.join() === l.pos.join() || m.note === l.note));
    let checked = 0;
    for (const l of pins.filter((l) => !unclear(l))) {
      const upper = l.note.slice(1, l.note.indexOf("-")) !== l.floor;
      const rooms = cubes(l.floor)
        .filter((c) => c.half > 0 === upper)
        .flatMap((c) => cubePlan(1).filter((p) => p.kind === "room").map((p) => ({ c, room: p.room!, d: dist(center(c, p), l.pos) })));
      const nearest = rooms.sort((a, b) => a.d - b.d)[0];
      expect(roomNumber(l.floor, nearest.c, nearest.room), `pin at ${l.pos}`).toBe(l.note);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
    expect(cubes("5").flatMap((c) => [1, 2, 3, 4].map((r) => roomNumber("5", c, r))).filter((n) => n.startsWith("F5-")).sort().at(-1)).toBe("F5-48");
  });

  it("puts each cube's inner stairs where the survey pinned them", () => {
    // two NE pins were dropped on the wrong half of their stack (their rooms carry the other floor's numbers)
    const pins = labels.filter((l) => l.note === "stair");
    const right = pins.filter((l) => {
      const half = l.level - floorLevel(l.floor);
      const parts = cubes(l.floor).filter((c) => c.half === half).flatMap((c) => cubeParts(c, 1).filter((p) => p.kind !== "room").map((p) => ({ kind: p.kind, d: dist(center(c, p), l.pos) })));
      return parts.sort((a, b) => a.d - b.d)[0].kind === "stairs";
    });
    expect(right.length).toBeGreaterThanOrEqual(pins.length - 2);
  });
});
