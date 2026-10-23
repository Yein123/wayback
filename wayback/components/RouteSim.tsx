"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CUBE, CUBE_ENTRY_X, cubePoint, cubes, FLOORS, floorLevel, HALLWAYS, hallwayPath, levelName, LIFT_FLOORS, type Cube } from "@/lib/building";
import { getSpot, map, spotLevel, type Spot } from "@/lib/map";
import type { Step } from "@/lib/route";

export type SimView = "2d" | "3d";

const S = 4; // screen px per map metre
const FLOOR_GAP = 46; // px between floor levels in 3D
const R = 80; // half-size of each drawn floor plane, in metres
const TILT_3D = 58;
const ZOOM = { "2d": 1, "3d": 0.5 }; // 3D pulls back to show the whole building

const GLOW = "#3EE6F2";
const VIOLET = "#9B7BFF";
const EDGE = "#1E2D42";
const LINE = "#3A5170";
const MUTED = "#8FA1AD";

type Point = { x: number; y: number; z: number };
type Walk = { start: Point; end: Point; t0: number; dur: number; h0: number; h1: number; index: number; done: boolean };

/**
 * Simulated walk along the route: the floor plan moves under a fixed "you" marker,
 * turns so you always face up (like GPS heading-up), and in 3D the floors are stacked
 * so a lift ride rises or sinks through them.
 */
export default function RouteSim({
  steps,
  stepIndex,
  view,
  onWalked,
}: {
  steps: Step[];
  stepIndex: number;
  view: SimView;
  onWalked: (index: number) => void;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const cam = useRef({ x: 0, y: 0, z: 0, heading: initialHeading(steps), tilt: view === "3d" ? TILT_3D : 0, zoom: ZOOM[view] });
  const walk = useRef<Walk | null>(null);
  const tiltTarget = useRef(view === "3d" ? TILT_3D : 0);
  const zoomTarget = useRef(ZOOM[view]);
  const walkedRef = useRef(onWalked);
  const [level, setLevel] = useState(() => {
    const here = getSpot(steps[stepIndex].from);
    return here ? spotLevel(here) : 0;
  });

  useEffect(() => {
    tiltTarget.current = view === "3d" ? TILT_3D : 0;
    zoomTarget.current = ZOOM[view];
    walkedRef.current = onWalked;
  });

  const layers = useMemo(() => drawLayers(steps, stepIndex), [steps, stepIndex]);

  // Start this step's walk from its first spot (so BACK and replays line up too).
  useEffect(() => {
    const step = steps[stepIndex];
    const a = getSpot(step.from);
    const b = getSpot(step.to);
    if (!a || !b) return;
    const start = toWorld(a);
    const end = toWorld(b);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const flat = Math.hypot(dx, dy) / S;
    const climb = Math.abs(end.z - start.z) / FLOOR_GAP;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = still ? 0 : flat > 0.5 ? clamp(flat * 110, 1100, 3600) : climb > 0 ? 800 + climb * 450 : 0;
    const h0 = cam.current.heading;
    walk.current = {
      start,
      end,
      t0: performance.now(),
      dur,
      h0,
      h1: flat > 0.5 ? (Math.atan2(dy, dx) * 180) / Math.PI : h0,
      index: stepIndex,
      done: false,
    };
  }, [steps, stepIndex]);

  // One animation loop for the whole screen: camera position, heading and tilt.
  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      const c = cam.current;
      const w = walk.current;
      if (w) {
        const ms = now - w.t0;
        const turn = w.dur === 0 ? 1 : ease(clamp(ms / 500, 0, 1));
        const k = w.dur === 0 ? 1 : ease(clamp((ms - 250) / w.dur, 0, 1));
        c.heading = lerpAngle(w.h0, w.h1, turn);
        c.x = lerp(w.start.x, w.end.x, k);
        c.y = lerp(w.start.y, w.end.y, k);
        c.z = lerp(w.start.z, w.end.z, k);
        if (k >= 1 && turn >= 1 && !w.done) {
          w.done = true;
          walkedRef.current(w.index);
        }
      }
      c.tilt += (tiltTarget.current - c.tilt) * 0.12;
      c.zoom += (zoomTarget.current - c.zoom) * 0.12;
      if (anchor.current) {
        anchor.current.style.transform = `scale(${c.zoom}) rotateX(${c.tilt}deg) rotateZ(${-90 - c.heading}deg) translate3d(${-c.x}px, ${-c.y}px, ${-c.z}px)`;
      }
      // In half levels, so standing in a cube lights up the cube layer and the floors either side.
      setLevel(Math.round((c.z / FLOOR_GAP) * 2) / 2);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-void [perspective:640px]">
      <div ref={anchor} className="absolute left-1/2 top-[64%] [transform-style:preserve-3d]">
        {layers.map((l) => (
          <div
            key={l.key}
            className="absolute left-0 top-0 transition-opacity duration-500"
            style={{ transform: `translateZ(${l.level * FLOOR_GAP}px)`, opacity: layerOpacity(l.level, level, view) }}
          >
            {l.svg}
          </div>
        ))}
      </div>

      {/* You: always in the middle, always facing up */}
      <div className="pointer-events-none absolute left-1/2 top-[64%] -translate-x-1/2 -translate-y-1/2">
        <span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border border-glow/60" />
        <svg width="26" height="30" viewBox="0 0 26 30" className="relative drop-shadow-[0_0_8px_rgba(62,230,242,0.9)]">
          <path d="M13 1 L25 28 L13 21 L1 28 Z" fill={GLOW} stroke="#070B12" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-edge bg-panel/80 px-2.5 py-1 font-hud text-xs tracking-widest text-glow">
        {levelName(Math.round(level))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-void to-transparent" />
    </div>
  );
}

function toWorld(spot: Spot): Point {
  return { x: spot.pos[0] * S, y: spot.pos[1] * S, z: spotLevel(spot) * FLOOR_GAP };
}

/** Your floor and the cubes half a flight off it are solid; the rest of the building is a faint stack in 3D. */
function layerOpacity(layer: number, here: number, view: SimView): number {
  // Your floor = the hallway level you're on (rounded down) and its cubes half a flight up and down.
  const d = Math.abs(layer - Math.floor(here));
  if (d <= 0.5) return 1;
  return view === "3d" ? Math.max(0.06, 0.2 - d * 0.02) : 0;
}

function initialHeading(steps: Step[]): number {
  for (const step of steps) {
    const a = getSpot(step.from);
    const b = getSpot(step.to);
    if (a && b && (a.pos[0] !== b.pos[0] || a.pos[1] !== b.pos[1])) {
      return (Math.atan2(b.pos[1] - a.pos[1], b.pos[0] - a.pos[0]) * 180) / Math.PI;
    }
  }
  return -90;
}

type Layer = { level: number; floor?: string; cubes: Cube[]; spots: Spot[] };

/**
 * One SVG plane per height in the building: every floor (lobby, X of hallways, end stairs) and,
 * half a flight above and below, the cubes. The route is drawn on top, split into done / now / ahead.
 */
function drawLayers(steps: Step[], stepIndex: number) {
  const layers = new Map<number, Layer>();
  const layer = (level: number) => {
    if (!layers.has(level)) layers.set(level, { level, cubes: [], spots: [] });
    return layers.get(level)!;
  };
  const allCubes = cubes();
  for (const floor of FLOORS) {
    const level = floorLevel(floor);
    layer(level).floor = floor;
    for (const c of allCubes) layer(level + c.half).cubes.push(c);
  }
  for (const s of map.spots) layer(spotLevel(s)).spots.push(s);

  const end = steps.at(-1)?.to;
  const at = (id: string) => getSpot(id)!;

  return [...layers.values()].map((l) => {
    const here = new Set(l.spots.map((s) => s.id));
    const corridors = map.links.filter((k) => k.from < k.to && here.has(k.from) && here.has(k.to));
    const legs = steps
      .map((step, i) => ({ step, i, a: at(step.from), b: at(step.to) }))
      .filter(({ a, b }) => {
        if (a.pos.join() === b.pos.join()) return false;
        // A half flight between levels is drawn on the lower one.
        return Math.min(spotLevel(a), spotLevel(b)) === l.level;
      });
    // Lift rides pass straight up through the floors in between.
    const shafts = steps
      .map((step, i) => ({ i, a: at(step.from), b: at(step.to) }))
      .filter(({ a, b }) => {
        const [lo, hi] = [spotLevel(a), spotLevel(b)].sort((x, y) => x - y);
        return a.pos.join() === b.pos.join() && l.floor && l.level >= lo && l.level <= hi;
      });
    const liftStop = l.floor ? LIFT_FLOORS.includes(l.floor) : false;

    const svg = (
      <svg
        width={R * 2 * S}
        height={R * 2 * S}
        viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`}
        className="absolute overflow-visible"
        style={{ left: -R * S, top: -R * S }}
      >
        {l.floor && (
          <g>
            {/* floor slab: the X of hallways around the lobby */}
            {HALLWAYS.map((h) => (
              <polyline
                key={h}
                points={hallwayPath(h).map((p) => p.join(",")).join(" ")}
                fill="none"
                stroke="#0E1624"
                strokeOpacity={0.9}
                strokeWidth={9}
                strokeLinecap="round"
              />
            ))}
            {HALLWAYS.map((h) => {
              const path = hallwayPath(h);
              const [ex, ey] = path.at(-1)!;
              return (
                <g key={h}>
                  <polyline points={path.map((p) => p.join(",")).join(" ")} fill="none" stroke={EDGE} strokeWidth={6} strokeLinecap="round" />
                  <polyline points={path.map((p) => p.join(",")).join(" ")} fill="none" stroke={LINE} strokeWidth={0.5} strokeDasharray="1.5 2" />
                  {/* staircase at the hallway's far end */}
                  {[-1.5, 0, 1.5].map((d) => (
                    <circle key={d} cx={ex + d * 0.6} cy={ey + d * 0.6} r={0.5} fill={LINE} />
                  ))}
                </g>
              );
            })}
            <rect x={-7} y={-7} width={14} height={14} rx={1.5} fill="#070B12" stroke={LINE} strokeWidth={0.6} />
            {[-4, -1.3, 1.3, 4].map((dx) => (
              <rect key={dx} x={dx - 1} y={-5.5} width={2} height={2.4} fill={liftStop ? LINE : EDGE} />
            ))}
            {[-4, -1.3, 1.3, 4].map((dx) => (
              <rect key={`b${dx}`} x={dx - 1} y={3.1} width={2} height={2.4} fill={liftStop ? LINE : EDGE} />
            ))}
            {!liftStop && (
              <text x={0} y={1.2} textAnchor="middle" fontSize={2.2} fill={MUTED} style={{ fontFamily: "var(--font-orbitron)" }}>
                NO LIFT STOP
              </text>
            )}
          </g>
        )}

        {l.cubes.map((c) => (
          <g key={`${c.hallway}${c.stair}${c.side}`}>
            <line x1={c.door[0]} y1={c.door[1]} x2={cubePoint(c, CUBE_ENTRY_X, 0)[0]} y2={cubePoint(c, CUBE_ENTRY_X, 0)[1]} stroke={EDGE} strokeWidth={1.4} />
            <rect
              x={-CUBE.width / 2}
              y={-CUBE.depth / 2}
              width={CUBE.width}
              height={CUBE.depth}
              rx={1}
              transform={`translate(${c.center[0]} ${c.center[1]}) rotate(${c.angle})`}
              fill={c.half > 0 ? "#122033" : "#0C1420"}
              stroke={c.half > 0 ? LINE : EDGE}
              strokeWidth={0.5}
            />
          </g>
        ))}

        {corridors.map((k) => {
          const [a, b] = [at(k.from).pos, at(k.to).pos];
          return (
            <g key={k.from + k.to}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={EDGE} strokeWidth={7} strokeLinecap="round" />
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={LINE} strokeWidth={0.5} strokeDasharray="1.5 2" />
            </g>
          );
        })}

        {shafts.map(({ i, a }) => (
          <circle
            key={`shaft${i}`}
            cx={a.pos[0]}
            cy={a.pos[1]}
            r={4.5}
            fill="none"
            stroke={i < stepIndex ? VIOLET : GLOW}
            strokeWidth={i === stepIndex ? 1.2 : 0.7}
            strokeOpacity={i < stepIndex ? 0.5 : 0.9}
          />
        ))}

        {legs.map(({ i, a, b }) => {
          const [p, q] = [a.pos, b.pos];
          const now = i === stepIndex;
          const done = i < stepIndex;
          const color = done ? VIOLET : GLOW;
          return (
            <g key={i} opacity={done ? 0.55 : 1}>
              <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={color} strokeWidth={now ? 5 : 3.5} strokeOpacity={0.22} strokeLinecap="round" />
              <line
                x1={p[0]}
                y1={p[1]}
                x2={q[0]}
                y2={q[1]}
                stroke={color}
                strokeWidth={now ? 1.8 : 1.1}
                strokeLinecap="round"
                strokeDasharray={now ? "3 2" : undefined}
                className={now ? "animate-flow" : undefined}
              />
            </g>
          );
        })}

        {l.spots.map((s) => (
          <Landmark key={s.id} spot={s} isEnd={s.id === end} />
        ))}
      </svg>
    );
    return { key: String(l.level), level: l.level, svg };
  });
}

function Landmark({ spot, isEnd }: { spot: Spot; isEnd: boolean }) {
  const [x, y] = spot.pos;
  const name = shortName(spot);
  return (
    <g>
      {/* the floor itself draws the lift lobby */}
      {spot.type === "lobby" ? null : spot.type === "parking" ? (
        <g>
          <rect x={x - 9} y={y - 7} width={18} height={14} rx={1.5} fill="none" stroke={LINE} strokeWidth={0.6} strokeDasharray="2 1.5" />
          <text x={x} y={y + 2.4} textAnchor="middle" fontSize={7} fill={LINE} fontWeight={700}>
            P
          </text>
        </g>
      ) : (
        <circle cx={x} cy={y} r={1.6} fill="#070B12" stroke={MUTED} strokeWidth={0.5} />
      )}
      {isEnd && (
        <g className="animate-pulse-glow">
          <circle cx={x} cy={y} r={6} fill="none" stroke={GLOW} strokeWidth={0.8} />
          <circle cx={x} cy={y} r={2.4} fill={GLOW} />
        </g>
      )}
      <text
        x={x}
        y={y + (spot.type === "parking" ? 11 : spot.type === "lobby" ? 10 : 6.5)}
        textAnchor="middle"
        fontSize={3}
        letterSpacing={0.3}
        fill={isEnd ? GLOW : MUTED}
        style={{ fontFamily: "var(--font-orbitron)" }}
      >
        {name}
      </text>
    </g>
  );
}

function shortName(spot: Spot): string {
  if (spot.room) return spot.room;
  const stair = spot.label.match(/Stair \d/);
  if (stair) return stair[0].toUpperCase();
  // "SE Entrance · Floor 1" → "SE ENTRANCE", "Floor 1 · SE Hallway" → "SE HALLWAY"
  const parts = spot.label.split("·").map((p) => p.trim());
  const name = spot.type === "entrance" ? parts[0] : parts.at(-1)!;
  return (spot.type === "lobby" ? "LIFTS" : spot.type === "parking" ? "CAR PARK" : name).toUpperCase();
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
function lerpAngle(a: number, b: number, t: number) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}
