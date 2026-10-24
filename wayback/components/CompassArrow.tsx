"use client";

import { compassName, ON_COURSE, turnBy, turnHint } from "@/lib/compass";

const GLOW = "#3EE6F2";
const GOOD = "#4ADE80";
const MUTED = "#8FA1AD";
const EDGE = "#1E2D42";

/**
 * Which way to walk: an arrow at the step's real compass bearing on an N/E/S/W dial. With the phone's
 * compass the dial turns with you and the mark at the top is where the phone points: turn until the arrow
 * sits in the green ±20° zone. Without it, N is up.
 */
export default function CompassArrow({ bearing, heading, fromGps = false }: { bearing: number; heading: number | null; fromGps?: boolean }) {
  const facing = heading ?? 0;
  const at = (deg: number, r: number) => {
    const a = ((deg - facing) * Math.PI) / 180;
    return { x: Math.sin(a) * r, y: -Math.cos(a) * r };
  };
  const turn = turnBy(bearing, facing);
  const onCourse = heading !== null && Math.abs(turn) <= ON_COURSE;
  // The ±20° zone at the top of the dial, where the phone points.
  const zone = (r: number) => {
    const s = Math.sin((ON_COURSE * Math.PI) / 180) * r;
    const c = -Math.cos((ON_COURSE * Math.PI) / 180) * r;
    return `M0 0 L${-s} ${c} A${r} ${r} 0 0 1 ${s} ${c} Z`;
  };
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="-50 -50 100 100" className="h-24 w-24 shrink-0" role="img" aria-label={`Head ${compassName(bearing)}`}>
        {heading !== null && <path d={zone(46)} fill={GOOD} opacity={onCourse ? 0.35 : 0.15} />}
        <circle r={46} fill="none" stroke={EDGE} strokeWidth={2} />
        {heading !== null && <path d="M0 -50 L5 -42 L-5 -42 Z" fill={onCourse ? GOOD : MUTED} />}
        {["N", "E", "S", "W"].map((name, i) => {
          const p = at(i * 90, 37);
          return (
            <text key={name} x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fill={name === "N" ? "#FFB547" : MUTED} style={{ fontFamily: "var(--font-orbitron)" }}>
              {name}
            </text>
          );
        })}
        <g transform={`rotate(${turn})`}>
          <path d="M0 -30 L12 6 L0 0 L-12 6 Z" fill={onCourse ? GOOD : GLOW} stroke="#070B12" strokeWidth={1.5} strokeLinejoin="round" />
        </g>
      </svg>
      <div className="flex flex-col gap-0.5">
        <p className={`font-hud text-sm tracking-[0.2em] ${onCourse ? "text-[#4ADE80]" : "text-glow"}`}>
          {heading === null ? `HEAD ${compassName(bearing)}` : onCourse ? "✓ RIGHT WAY" : turnHint(turn)}
        </p>
        <p className="text-xs text-muted">
          {heading === null
            ? "Compass off: N is up on the dial."
            : onCourse
              ? `Keep going ${compassName(bearing)}.`
              : `Turn until the arrow is in the green zone (${compassName(bearing)}).`}
        </p>
        {fromGps && <p className="font-hud text-[10px] tracking-widest text-violet">FROM YOUR GPS SPOT</p>}
      </div>
    </div>
  );
}
