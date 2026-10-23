// Floor outlines drawn over an uploaded plan, and turning them into metres for 3D.
// Pure functions (tested in tests/outline.test.ts). Points are plan-image pixels, x right, y down.

export type Point = [number, number];

export const OUTLINE_KINDS = ["hallway", "room", "lobby", "lift", "stairs", "toilet", "other"] as const;
export type OutlineKind = (typeof OUTLINE_KINDS)[number];

export type Outline = { kind: OutlineKind; points: Point[] };

/** How tall each kind of shape stands, as a share of one floor's height (hallways are just floor). */
export const KIND_HEIGHT: Record<OutlineKind, number> = {
  hallway: 0.06,
  lobby: 0.06,
  room: 0.75,
  toilet: 0.75,
  lift: 1,
  stairs: 0.5,
  other: 0.4,
};

/** Metres per plan pixel, from two points on the plan you know the real distance between. */
export function metresPerPixel(a: Point, b: Point, metres: number): number | null {
  const px = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return px > 0 && metres > 0 ? metres / px : null;
}

/** Area of a shape in square pixels (shoelace formula); multiply by mpp² for m². */
export function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** A plan point in metres from the plan's centre (x right, y down), so every floor lines up around one spot. */
export function toMetres([x, y]: Point, size: { width: number; height: number }, mpp: number): Point {
  return [(x - size.width / 2) * mpp, (y - size.height / 2) * mpp];
}

/** Firestore can't store arrays of arrays, so points are saved flat: [x1, y1, x2, y2, …]. */
export function flatten(points: Point[]): number[] {
  return points.flatMap(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
}

export function unflatten(flat: number[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
  return out;
}
