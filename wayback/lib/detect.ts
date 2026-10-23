// Auto-detect shapes on a flat-colour floor plan (mall directories): sort pixels by colour, group touching
// shop pixels into blocks, and outline each block, so every shop can stand up as a 3D box.
// Pure (tested in tests/detect.test.ts): works on raw RGBA pixels, scaled back to plan pixels.
import type { Outline, OutlineKind, Point } from "@/lib/outline";

export type Pixels = { data: Uint8ClampedArray | number[]; width: number; height: number };

type Class = 0 | 1 | 2 | 3; // background, walkway, shop, lift

/** Sorts a pixel: dark = background, very light grey = walkway, blue = lift/escalator, anything else = shop. */
export function classify(r: number, g: number, b: number): Class {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const sat = max === 0 ? 0 : (max - min) / max;
  if (light < 55) return 0;
  if (b > r + 25 && b > g + 5 && sat > 0.2) return 3;
  if (light > 205 && sat < 0.12) return 1;
  return 2;
}

/**
 * Finds the blocks on a plan. `scale` maps detection pixels back to plan pixels.
 * Shops become rooms, blue blocks become lifts; tiny specks (< minShare of the image) are dropped.
 */
export function detectShapes(img: Pixels, scale = 1, minShare = 0.0003, tolerance = 14): Outline[] {
  const { width: w, height: h, data } = img;
  const cls = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) cls[i] = classify(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);

  // Shave one pixel off every shop edge so shops that only touch through a thin border come apart.
  const solid = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const c = cls[i];
      if (c >= 2 && cls[i - 1] === c && cls[i + 1] === c && cls[i - w] === c && cls[i + w] === c) solid[i] = c;
    }
  }

  const seen = new Uint8Array(w * h);
  const minPixels = Math.max(6, Math.round(w * h * minShare));
  const out: Outline[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    const c = solid[start];
    if (!c || seen[start]) continue;
    // Flood fill one block of (nearly) the same colour, so the thin lighter borders between shops split them.
    const [r0, g0, b0] = [data[start * 4], data[start * 4 + 1], data[start * 4 + 2]];
    const same = (n: number) =>
      Math.abs(data[n * 4] - r0) <= tolerance && Math.abs(data[n * 4 + 1] - g0) <= tolerance && Math.abs(data[n * 4 + 2] - b0) <= tolerance;
    const pts: Point[] = [];
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      pts.push([x, y]);
      for (const n of [i - 1, i + 1, i - w, i + w]) {
        if (n >= 0 && n < w * h && !seen[n] && solid[n] === c && same(n) && Math.abs((n % w) - x) <= 1) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    if (pts.length < minPixels) continue;
    const hull = convexHull(pts).map(([x, y]): Point => [Math.round((x + 0.5) * scale), Math.round((y + 0.5) * scale)]);
    const kind: OutlineKind = c === 3 ? "lift" : "room";
    out.push({ kind, points: simplify(hull, scale * 1.5) });
  }
  return out;
}

/** Smallest convex shape around the points (Andrew's monotone chain). */
export function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Drops corners that sit almost on the line between their neighbours (keeps shapes light to store). */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length <= 4) return points;
  const kept = points.filter((p, i) => {
    const a = points[(i - 1 + points.length) % points.length];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const dist = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len;
    return dist > tolerance;
  });
  return kept.length >= 3 ? kept : points;
}
