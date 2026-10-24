"use client";

import { compassName } from "@/lib/compass";

const GLOW = "#3EE6F2";
const MUTED = "#8FA1AD";
const EDGE = "#1E2D42";

/**
 * Which way to walk: an arrow at the step's real compass bearing on an N/E/S/W dial. With the phone's
 * compass the dial turns with you, so the arrow points the way to go in your hand; without it, N is up.
 */
export default function CompassArrow({ bearing, heading }: { bearing: number; heading: number | null }) {
  const facing = heading ?? 0;
  const at = (deg: number, r: number) => {
    const a = ((deg - facing) * Math.PI) / 180;
    return { x: Math.sin(a) * r, y: -Math.cos(a) * r };
  };
  const ahead = Math.abs((((bearing - facing) % 360) + 540) % 360 - 180) < 25;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="-50 -50 100 100" className="h-20 w-20 shrink-0" role="img" aria-label={`Head ${compassName(bearing)}`}>
        <circle r={46} fill="none" stroke={EDGE} strokeWidth={2} />
        {["N", "E", "S", "W"].map((name, i) => {
          const p = at(i * 90, 37);
          return (
            <text key={name} x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fill={name === "N" ? "#FFB547" : MUTED} style={{ fontFamily: "var(--font-orbitron)" }}>
              {name}
            </text>
          );
        })}
        <g transform={`rotate(${bearing - facing})`}>
          <path d="M0 -28 L11 6 L0 0 L-11 6 Z" fill={GLOW} stroke="#070B12" strokeWidth={1.5} strokeLinejoin="round" />
        </g>
      </svg>
      <div className="flex flex-col gap-0.5">
        <p className="font-hud text-sm tracking-[0.2em] text-glow">HEAD {compassName(bearing)}</p>
        <p className="text-xs text-muted">
          {heading === null ? "Compass off: N is up on the dial." : ahead ? "You're facing the right way." : "Turn until the arrow points up."}
        </p>
      </div>
    </div>
  );
}
