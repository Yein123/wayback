// The whole M06 block, generated from its layout rules (every floor is the same):
// a central lift lobby, four hallways in an X, and on each hallway four stairs whose
// cubes sit half a flight down (stairs 1 and 4) or half a flight up (stairs 2 and 3), one each side.
// The route itself still comes from dorm-map.json; this is the structure drawn around it.

export const FLOORS = ["B2", "B1", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
export const LIFT_FLOORS = ["B2", "1", "3", "5", "7", "9"];

export type Hallway = "NW" | "NE" | "SE" | "SW";
export const HALLWAYS: Hallway[] = ["NW", "NE", "SE", "SW"];

export type Cube = {
  hallway: Hallway;
  stair: number; // 1–4, from the lifts outward
  side: "left" | "right";
  /** Half a flight above (+0.5) or below (-0.5) the hallway. */
  half: 0.5 | -0.5;
  center: [number, number];
  /** Where its stairs meet the hallway. */
  door: [number, number];
  /** Degrees, the hallway's direction going outward. */
  angle: number;
};

// SE hallway stair positions (metres, x east, y south) — the same numbers as the SE stair spots in dorm-map.json.
const SE_STAIRS: [number, number][] = [
  [14, 11],
  [27, 21],
  [40, 31],
  [53, 41],
];
const SE_END: [number, number] = [62, 48];
const CUBE_GAP = { lower: 9, upper: 13 }; // upper cubes sit further back from the hallway

const MIRROR: Record<Hallway, [number, number]> = { SE: [1, 1], NE: [1, -1], SW: [-1, 1], NW: [-1, -1] };

const flip = (h: Hallway, [x, y]: [number, number]): [number, number] => [x * MIRROR[h][0], y * MIRROR[h][1]];

/** Stair landings along a hallway, lifts outward, then the staircase at its far end. */
export function hallwayPath(h: Hallway): [number, number][] {
  return [[0, 0], ...SE_STAIRS, SE_END].map((p) => flip(h, p as [number, number]));
}

export function cubes(): Cube[] {
  const [dx, dy] = norm(SE_END);
  return HALLWAYS.flatMap((h) =>
    SE_STAIRS.flatMap((stair, i) => {
      const half = i === 1 || i === 2 ? 0.5 : -0.5;
      const gap = half > 0 ? CUBE_GAP.upper : CUBE_GAP.lower;
      return (["right", "left"] as const).map((side): Cube => {
        // In SE terms "right" of the outward direction is south-west; mirroring keeps each cube on its own side.
        const s = side === "right" ? 1 : -1;
        const seCenter: [number, number] = [stair[0] - dy * gap * s, stair[1] + dx * gap * s];
        const [ox, oy] = flip(h, [dx, dy]);
        return {
          hallway: h,
          stair: i + 1,
          side,
          half,
          center: flip(h, seCenter),
          door: flip(h, stair),
          angle: (Math.atan2(oy, ox) * 180) / Math.PI,
        };
      });
    }),
  );
}

/** A cube's footprint: `width` along the hallway, `depth` away from it. */
export const CUBE = { width: 12, depth: 5 };

/** Where you step in from the hallway: the gap between the toilet and the stairs. */
export const CUBE_ENTRY_X = 0.9;

/**
 * A point inside a cube, read off the learner's floor plan with the hallway along the top:
 * `x` is metres across the plan (− = the plan's left, which is your right as you walk in),
 * `d` is metres in from the hallway edge.
 */
export function cubePoint(c: Cube, x: number, d: number): [number, number] {
  const len = Math.hypot(c.center[0] - c.door[0], c.center[1] - c.door[1]);
  const f = [(c.center[0] - c.door[0]) / len, (c.center[1] - c.door[1]) / len]; // walking in
  const yourLeft = [f[1], -f[0]];
  const nx = c.center[0] - f[0] * (CUBE.depth / 2);
  const ny = c.center[1] - f[1] * (CUBE.depth / 2);
  return [nx + yourLeft[0] * x + f[0] * d, ny + yourLeft[1] * x + f[1] * d];
}

export type CubePart = { kind: "room" | "toilet" | "stairs"; room?: number; x: [number, number]; d: [number, number] };

/**
 * Inside every cube (learner's plan, 2 floors): you enter between the toilet and the stairs into a
 * T-shaped corridor; rooms 4 and 1 at the two ends, rooms 3 and 2 along the back.
 * Floor 2 is the same with the toilet and the stairs swapped.
 */
export function cubePlan(floor: 1 | 2): CubePart[] {
  const left: [number, number] = [-4.1, 0.47];
  const right: [number, number] = [1.33, 4.17];
  const top: [number, number] = [0, 1.8];
  return [
    { kind: "toilet", x: floor === 1 ? left : right, d: top },
    { kind: "stairs", x: floor === 1 ? right : left, d: top },
    { kind: "room", room: 4, x: [-5.94, -4.17], d: [1.1, 4.9] },
    { kind: "room", room: 3, x: [-3.22, -0.04], d: [2.8, 4.9] },
    { kind: "room", room: 2, x: [0.06, 3.35], d: [2.8, 4.9] },
    { kind: "room", room: 1, x: [4.17, 5.94], d: [1.1, 4.9] },
  ];
}

/** Floors as stacking levels: B2 → -2, B1 → -1, 1 → 0, 5 → 4, 10 → 9. */
export function floorLevel(floor: string): number {
  return floor.startsWith("B") ? -Number(floor.slice(1)) : Number(floor) - 1;
}

export function levelName(level: number): string {
  return level >= 0 ? `FLOOR ${level + 1}` : `B${-level}`;
}

function norm([x, y]: [number, number]): [number, number] {
  const len = Math.hypot(x, y);
  return [x / len, y / len];
}
