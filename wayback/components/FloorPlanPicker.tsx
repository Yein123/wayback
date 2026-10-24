"use client";

import { useRef, useState } from "react";
import { CUBE, CUBE_ENTRY_X, cubeParts, cubePlan, cubePoint, cubes, floorLevel, HALLWAYS, hallwayPath, PLAN, type Cube } from "@/lib/building";
import { map, spotLevel, type Spot } from "@/lib/map";

export type Pin = {
  pos: [number, number];
  spot: Spot | null;
  /** Height in floor levels: the floor itself, or ±0.5 inside a cube. */
  level: number;
  /** Set when the pin is inside a cube: which one, and the room it's in (if any). */
  cube?: { hallway: string; side: string; stair: number; room: number | null };
};

const R = 82; // metres shown either side of the lobby
const ZOOM = 13; // metres shown either side of a cube when zoomed in
const SNAP = 5; // a tap this close to a known spot picks that spot

type Stack = { hallway: string; side: string; upper: Cube; lower: Cube };

/**
 * One floor's plan (hallways, lobby, cubes, known spots). Tap where you're standing to drop a pin;
 * tap a cube to zoom in and pin a spot inside it (rooms 1–4, toilet), on its upper or lower cube.
 */
export default function FloorPlanPicker({
  floor,
  pin,
  onPin,
  saved = [],
}: {
  floor: string;
  pin: Pin | null;
  onPin: (pin: Pin) => void;
  /** Places already surveyed on this floor, shown as violet rings. */
  saved?: [number, number][];
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState<Stack | null>(null);
  const [upper, setUpper] = useState(true);
  const level = floorLevel(floor);
  const allCubes = cubes(floor);
  const stacks: Stack[] = allCubes
    .filter((c) => c.stair === 2 || c.stair === 3)
    .map((up) => ({
      hallway: up.hallway,
      side: up.side,
      upper: up,
      lower: allCubes.find((c) => c.hallway === up.hallway && c.side === up.side && c.stair === (up.stair === 2 ? 1 : 4))!,
    }));

  const cube = zoom ? (upper ? zoom.upper : zoom.lower) : null;
  const pinLevel = cube ? level + cube.half : level;
  // Known spots at what you're looking at: this floor's plan, or the zoomed cube's level.
  const spots = map.spots.filter((s) => (cube ? spotLevel(s) === pinLevel : Math.floor(spotLevel(s)) === level));

  function point(e: React.PointerEvent<SVGSVGElement>): [number, number] | null {
    const ctm = svg.current?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10];
  }

  function tap(e: React.PointerEvent<SVGSVGElement>) {
    const pos = point(e);
    if (!pos) return;
    const nearest = spots
      .map((s) => ({ s, d: Math.hypot(s.pos[0] - pos[0], s.pos[1] - pos[1]) }))
      .sort((a, b) => a.d - b.d)[0];
    const snap = nearest && nearest.d <= (cube ? 1.5 : SNAP) ? nearest.s : null;

    if (!cube) {
      // Tapping a cube (away from any known spot) zooms into it instead of pinning.
      const hit = snap ? null : stacks.find((s) => inside(polygon(s.upper, [-PLAN.width / 2, PLAN.width / 2], [0, PLAN.depth]), pos));
      if (hit) {
        setZoom(hit);
        return;
      }
      onPin({ pos: snap?.pos ?? pos, spot: snap, level: snap ? spotLevel(snap) : level });
      return;
    }
    const room = cubePlan(1).find((p) => p.kind === "room" && inside(polygon(cube, p.x, p.d), pos))?.room ?? null;
    onPin({
      pos: snap?.pos ?? pos,
      spot: snap,
      level: pinLevel,
      cube: { hallway: cube.hallway, side: cube.side, stair: cube.stair, room },
    });
  }

  const view = cube ? `${cube.center[0] - ZOOM} ${cube.center[1] - ZOOM} ${ZOOM * 2} ${ZOOM * 2}` : `${-R} ${-R} ${R * 2} ${R * 2}`;

  return (
    <div className="flex flex-col gap-2">
      {zoom && (
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setZoom(null)} className="font-hud text-[10px] tracking-widest text-muted">
            ‹ WHOLE FLOOR
          </button>
          <div className="flex overflow-hidden rounded-lg border border-edge font-hud text-[10px] tracking-widest">
            {[true, false].map((u) => (
              <button
                key={String(u)}
                type="button"
                onClick={() => setUpper(u)}
                className={`px-2.5 py-1 ${u === upper ? "bg-glow/20 text-glow" : "text-muted"}`}
              >
                {u ? "UPPER ½↑" : "LOWER ½↓"}
              </button>
            ))}
          </div>
        </div>
      )}
      <svg
        ref={svg}
        viewBox={view}
        onPointerDown={tap}
        className="aspect-square w-full touch-none rounded-xl border border-edge bg-void"
        role="img"
        aria-label={cube ? "Cube plan: tap where you are standing" : `Floor ${floor} plan: tap where you are standing, or tap a cube to zoom in`}
      >
        {HALLWAYS.map((h) => (
          <polyline key={h} points={hallwayPath(h, floor).map((p) => p.join(",")).join(" ")} fill="none" stroke="#1E2D42" strokeWidth={5} strokeLinecap="round" />
        ))}
        {stacks.map((s) => (
          <rect
            key={`${s.hallway}${s.side}${s.upper.stair}`}
            x={-CUBE.width / 2}
            y={-CUBE.depth / 2}
            width={CUBE.width}
            height={CUBE.depth}
            rx={1}
            transform={`translate(${s.upper.center[0]} ${s.upper.center[1]}) rotate(${s.upper.angle})`}
            fill="#0E1624"
            stroke="#3A5170"
            strokeWidth={cube ? 0.15 : 0.4}
          />
        ))}
        {allCubes
          .filter((c) => !cube || c === cube)
          .map((c) => {
            const entry = cubePoint(c, CUBE_ENTRY_X, 0);
            return (
              <line
                key={`s${c.hallway}${c.side}${c.stair}`}
                x1={c.door[0]}
                y1={c.door[1]}
                x2={entry[0]}
                y2={entry[1]}
                stroke={cube ? "#9B7BFF" : "#3A5170"}
                strokeWidth={cube ? 0.5 : 1}
              />
            );
          })}
        {!cube && (
          <>
            <rect x={-8} y={-8} width={16} height={16} rx={1.5} fill="#070B12" stroke="#3A5170" strokeWidth={0.5} />
            <text x={0} y={1.5} textAnchor="middle" fontSize={4} fill="#8FA1AD" style={{ fontFamily: "var(--font-orbitron)" }}>
              LIFTS
            </text>
          </>
        )}

        {cube &&
          cubeParts(cube, 1).map((p) => {
            const pts = polygon(cube, p.x, p.d);
            const [cx, cy] = cubePoint(cube, (p.x[0] + p.x[1]) / 2, (p.d[0] + p.d[1]) / 2);
            const mine = pin?.cube?.room === p.room && p.kind === "room";
            return (
              <g key={`${p.kind}${p.room ?? ""}`}>
                <polygon
                  points={pts.map((q) => q.join(",")).join(" ")}
                  fill={p.kind === "room" ? (mine ? "#3EE6F2" : "#0F3A44") : p.kind === "stairs" ? "#2A2150" : "#26313D"}
                  fillOpacity={mine ? 0.35 : 0.6}
                  stroke={p.kind === "room" ? "#46D9E6" : p.kind === "stairs" ? "#9B7BFF" : "#8FA1AD"}
                  strokeWidth={0.12}
                />
                <text x={cx} y={cy + 0.5} textAnchor="middle" fontSize={p.kind === "stairs" ? 1 : 1.4} fill="#E6F1F5" style={{ fontFamily: "var(--font-orbitron)" }}>
                  {p.kind === "room" ? p.room : p.kind === "stairs" ? "STAIRS" : "WC"}
                </text>
              </g>
            );
          })}

        {spots.map((s) => (
          <circle key={s.id} cx={s.pos[0]} cy={s.pos[1]} r={cube ? 0.4 : 1.6} fill={pin?.spot?.id === s.id ? "#3EE6F2" : "#8FA1AD"} />
        ))}

        {saved.map((p) => (
          <circle key={p.join(",")} cx={p[0]} cy={p[1]} r={cube ? 0.7 : 2.6} fill="none" stroke="#9B7BFF" strokeWidth={cube ? 0.15 : 0.6} />
        ))}

        {pin && (!cube || pin.level === pinLevel) && (
          <g>
            <circle cx={pin.pos[0]} cy={pin.pos[1]} r={cube ? 1 : 4} fill="none" stroke="#3EE6F2" strokeWidth={cube ? 0.2 : 0.8} />
            <circle cx={pin.pos[0]} cy={pin.pos[1]} r={cube ? 0.35 : 1.4} fill="#3EE6F2" />
          </g>
        )}
      </svg>
      {!cube && <p className="text-xs text-muted">Tip: tap a cube to zoom in and pin a spot inside it.</p>}
    </div>
  );
}

/** The four corners of an area on the cube plan, on the map. */
function polygon(c: Cube, x: [number, number], d: [number, number]): [number, number][] {
  return [cubePoint(c, x[0], d[0]), cubePoint(c, x[1], d[0]), cubePoint(c, x[1], d[1]), cubePoint(c, x[0], d[1])];
}

function inside(poly: [number, number][], [px, py]: [number, number]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
