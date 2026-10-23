"use client";

import { useRef } from "react";
import { CUBE, CUBE_ENTRY_X, cubePoint, cubes, floorLevel, HALLWAYS, hallwayPath } from "@/lib/building";
import { map, spotLevel, type Spot } from "@/lib/map";

export type Pin = { pos: [number, number]; spot: Spot | null };

const R = 82; // metres shown either side of the lobby
const SNAP = 5; // a tap this close to a known spot picks that spot

/** One floor's plan (hallways, lobby, cubes, known spots). Tap where you're standing to drop a pin. */
export default function FloorPlanPicker({ floor, pin, onPin }: { floor: string; pin: Pin | null; onPin: (pin: Pin) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const level = floorLevel(floor);
  // Spots on this floor's plan, including cubes half a flight off its hallways.
  const spots = map.spots.filter((s) => Math.floor(spotLevel(s)) === level);
  const allCubes = cubes();

  function tap(e: React.PointerEvent<SVGSVGElement>) {
    const el = svg.current;
    const ctm = el?.getScreenCTM();
    if (!el || !ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const pos: [number, number] = [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10];
    const nearest = spots
      .map((s) => ({ s, d: Math.hypot(s.pos[0] - pos[0], s.pos[1] - pos[1]) }))
      .sort((a, b) => a.d - b.d)[0];
    onPin(nearest && nearest.d <= SNAP ? { pos: nearest.s.pos, spot: nearest.s } : { pos, spot: null });
  }

  return (
    <svg
      ref={svg}
      viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`}
      onPointerDown={tap}
      className="aspect-square w-full touch-none rounded-xl border border-edge bg-void"
      role="img"
      aria-label={`Floor ${floor} plan: tap where you are standing`}
    >
      {HALLWAYS.map((h) => (
        <polyline key={h} points={hallwayPath(h).map((p) => p.join(",")).join(" ")} fill="none" stroke="#1E2D42" strokeWidth={5} strokeLinecap="round" />
      ))}
      {allCubes
        .filter((c) => c.stair === 1 || c.stair === 4) // one footprint per stack
        .map((c) => (
          <rect
            key={`${c.hallway}${c.side}${c.stair}`}
            x={-CUBE.width / 2}
            y={-CUBE.depth / 2}
            width={CUBE.width}
            height={CUBE.depth}
            rx={1}
            transform={`translate(${c.center[0]} ${c.center[1]}) rotate(${c.angle})`}
            fill="#0E1624"
            stroke="#3A5170"
            strokeWidth={0.4}
          />
        ))}
      {allCubes.map((c) => {
        const entry = cubePoint(c, CUBE_ENTRY_X, 0);
        return <line key={`s${c.hallway}${c.side}${c.stair}`} x1={c.door[0]} y1={c.door[1]} x2={entry[0]} y2={entry[1]} stroke="#3A5170" strokeWidth={1} />;
      })}
      <rect x={-8} y={-8} width={16} height={16} rx={1.5} fill="#070B12" stroke="#3A5170" strokeWidth={0.5} />
      <text x={0} y={1.5} textAnchor="middle" fontSize={4} fill="#8FA1AD" style={{ fontFamily: "var(--font-orbitron)" }}>
        LIFTS
      </text>

      {spots.map((s) => (
        <g key={s.id}>
          <circle cx={s.pos[0]} cy={s.pos[1]} r={1.6} fill={pin?.spot?.id === s.id ? "#3EE6F2" : "#8FA1AD"} />
        </g>
      ))}

      {pin && (
        <g>
          <circle cx={pin.pos[0]} cy={pin.pos[1]} r={4} fill="none" stroke="#3EE6F2" strokeWidth={0.8} />
          <circle cx={pin.pos[0]} cy={pin.pos[1]} r={1.4} fill="#3EE6F2" />
        </g>
      )}
    </svg>
  );
}
