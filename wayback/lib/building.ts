// The whole M06 block, generated from its layout rules (every floor is the same):
// a central lift lobby, four hallways in an X, and on each hallway four stairs whose
// cubes sit half a flight down (stairs 1 and 4) or half a flight up (stairs 2 and 3), on both sides.
// The cubes stack: stair 1's cube is directly under stair 2's, and stair 4's directly under stair 3's.
// Each cube has one straight stair from the hallway; facing a stack, stairs 1 and 3 come in on its left
// and stairs 2 and 4 on its right, so the two cubes of a stack are mirror images of each other.
// The route itself still comes from dorm-map.json; this is the structure drawn around it.

export const FLOORS = ["B2", "B1", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
export const LIFT_FLOORS = ["B2", "1", "3", "5", "7", "9"];

export type Hallway = "NW" | "NE" | "SE" | "SW";
export const HALLWAYS: Hallway[] = ["NW", "NE", "SE", "SW"];

export type Cube = {
  hallway: Hallway;
  stair: number; // 1–4, from the lifts outward
  side: "left" | "right"; // of the hallway, walking out from the lifts
  /** Half a flight above (+0.5) or below (-0.5) the hallway. */
  half: 0.5 | -0.5;
  center: [number, number];
  /** Where its stair starts, on the hallway's centre line. */
  door: [number, number];
  /** Unit vector from the hallway into the cube. */
  inward: [number, number];
  /** Facing the cube from the hallway, is its stair (and its own inner stairs) on the right? */
  stairsRight: boolean;
  /** Degrees, the hallway's direction going outward. */
  angle: number;
};

const SE_END: [number, number] = [62, 48];
// How far out from the lifts each stack of cubes sits along the SE hallway (metres).
const STACKS = [26, 58.8];
const CUBE_GAP = 11; // hallway centre line to a cube's centre

const MIRROR: Record<Hallway, [number, number]> = { SE: [1, 1], NE: [1, -1], SW: [-1, 1], NW: [-1, -1] };

const flip = (h: Hallway, [x, y]: [number, number]): [number, number] => [x * MIRROR[h][0], y * MIRROR[h][1]];

/** A cube's footprint in metres: `width` along the hallway, `depth` away from it. */
export const CUBE = { width: 16, depth: 7 };

/** The learner's floor plan is drawn 12 × 5 plan-metres; it's stretched to the cube's real size. */
export const PLAN = { width: 12, depth: 5 };
export const PLAN_SCALE = { x: CUBE.width / PLAN.width, d: CUBE.depth / PLAN.depth };

/** Where the hallway stair arrives (plan x): the open corner by the end room on the stair's side. */
export const CUBE_ENTRY_X = 5.1;

/** The hallway's centre line, lifts outward, through both stacks to the staircase at its far end. */
export function hallwayPath(h: Hallway): [number, number][] {
  const [ux, uy] = norm(SE_END);
  return [[0, 0], ...STACKS.map((t): [number, number] => [ux * t, uy * t]), SE_END].map((p) => flip(h, p as [number, number]));
}

export function cubes(): Cube[] {
  const [ux, uy] = norm(SE_END);
  return HALLWAYS.flatMap((h) =>
    [1, 2, 3, 4].flatMap((stair) => {
      const half = stair === 2 || stair === 3 ? 0.5 : -0.5;
      const t = STACKS[stair <= 2 ? 0 : 1];
      return (["right", "left"] as const).map((side): Cube => {
        // In SE terms "right" of the outward direction is south-west.
        const s = side === "right" ? 1 : -1;
        const inward = flip(h, [-uy * s, ux * s]);
        const center = flip(h, [ux * t - uy * s * CUBE_GAP, uy * t + ux * s * CUBE_GAP]);
        const stairsRight = stair === 2 || stair === 4;
        const cube = { hallway: h, stair, side, half, center, inward, stairsRight, door: center, angle: 0 } as Cube;
        // the stair runs straight in from the hallway's centre line to the cube's entry gap
        const entry = cubePoint(cube, CUBE_ENTRY_X, 0);
        const back = CUBE_GAP - CUBE.depth / 2;
        cube.door = [entry[0] - inward[0] * back, entry[1] - inward[1] * back];
        const [ox, oy] = flip(h, [ux, uy]);
        cube.angle = (Math.atan2(oy, ox) * 180) / Math.PI;
        return cube;
      });
    }),
  );
}

/**
 * A point inside a cube, read off the learner's floor plan with the hallway along the top:
 * `x` is plan-metres across it (+ = the stairs side), `d` is plan-metres in from the hallway edge.
 */
export function cubePoint(c: Cube, x: number, d: number): [number, number] {
  const f = c.inward; // walking in
  const plus = c.stairsRight ? [-f[1], f[0]] : [f[1], -f[0]]; // your right : your left (map y points south)
  const nx = c.center[0] - f[0] * (CUBE.depth / 2);
  const ny = c.center[1] - f[1] * (CUBE.depth / 2);
  const [sx, sd] = [x * PLAN_SCALE.x, d * PLAN_SCALE.d];
  return [nx + plus[0] * sx + f[0] * sd, ny + plus[1] * sx + f[1] * sd];
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
