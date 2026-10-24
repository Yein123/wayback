"use client";

import { useId, type ReactNode } from "react";
import type { Diagram } from "@/lib/map";

const GLOW = "#3EE6F2";
const LINE = "#3A5170";
const MUTED = "#8FA1AD";

/** Flat, slightly tilted SVG picture of one direction step, with the right choice glowing. */
export default function StepDiagram({ diagram }: { diagram: Diagram }) {
  const id = useId().replace(/:/g, "");
  const glow = `url(#glow-${id})`;

  return (
    <svg viewBox="0 0 320 200" className="w-full rounded-xl border border-edge bg-void" role="img" aria-label={describe(diagram)}>
      <defs>
        {/* userSpaceOnUse so perfectly straight lines (zero-width boxes) still glow */}
        <filter id={`glow-${id}`} filterUnits="userSpaceOnUse" x="-40" y="-40" width="400" height="280">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id={`arrow-${id}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={GLOW} />
        </marker>
      </defs>
      <g transform="translate(160 100) skewX(-6) translate(-160 -100)">{draw(diagram, glow, `url(#arrow-${id})`)}</g>
    </svg>
  );
}

function Pulse({ children }: { children: ReactNode }) {
  return <g className="animate-pulse-glow">{children}</g>;
}

function Label({ x, y, children, color = MUTED, size = 11 }: { x: number; y: number; children: ReactNode; color?: string; size?: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" fill={color} fontSize={size} letterSpacing="2" style={{ fontFamily: "var(--font-orbitron)" }}>
      {children}
    </text>
  );
}

function draw(d: Diagram, glow: string, arrow: string): ReactNode {
  switch (d.kind) {
    case "lifts": {
      // The lobby seen from its entrance: the lifts face each other, half on each wall, drawn in perspective.
      const all = d.highlight < 0;
      const perSide = Math.ceil(d.count / 2);
      // a point on a side wall: depth t (0 near, 1 far) and height h (0 floor, 1 ceiling)
      const wall = (side: -1 | 1, t: number, h: number): [number, number] => {
        const x = 160 + side * (150 - t * 95);
        const floor = 190 - t * 62;
        const ceiling = 8 + t * 52;
        return [x, floor - h * (floor - ceiling)];
      };
      const quad = (pts: [number, number][]) => pts.map((p) => p.join(",")).join(" ");
      const doors = Array.from({ length: d.count }, (_, i) => {
        const side = i < perSide ? -1 : 1;
        const slot = i % perSide;
        // doors spread along the wall's depth, nearest first
        const t0 = 0.12 + (slot * 0.8) / perSide;
        const t1 = t0 + 0.5 / perSide;
        const lit = all || i === d.highlight;
        const stroke = lit ? GLOW : LINE;
        const seamTop = wall(side as -1 | 1, (t0 + t1) / 2, 0.7);
        const seamBottom = wall(side as -1 | 1, (t0 + t1) / 2, 0);
        // call buttons on the wall just past the door
        const [bx, by] = wall(side as -1 | 1, t1 + 0.04, 0.38);
        const [lx, ly] = wall(side as -1 | 1, (t0 + t1) / 2, 0.8);
        const door = (
          <g key={i}>
            <polygon
              points={quad([wall(side as -1 | 1, t0, 0), wall(side as -1 | 1, t0, 0.7), wall(side as -1 | 1, t1, 0.7), wall(side as -1 | 1, t1, 0)])}
              fill={lit ? "rgba(62,230,242,0.12)" : "none"}
              stroke={stroke}
              strokeWidth={lit ? 3 : 2}
              strokeLinejoin="round"
              filter={lit ? glow : undefined}
            />
            <line x1={seamTop[0]} y1={seamTop[1]} x2={seamBottom[0]} y2={seamBottom[1]} stroke={stroke} strokeWidth="1.5" />
            <rect x={bx - 3} y={by - 7} width={6} height={14} rx={1.5} fill="none" stroke={lit ? GLOW : MUTED} strokeWidth="1.2" />
            <path d={`M${bx - 1.6} ${by - 2} l1.6 -2.5 l1.6 2.5 M${bx - 1.6} ${by + 2} l1.6 2.5 l1.6 -2.5`} fill="none" stroke={lit ? GLOW : MUTED} strokeWidth="1" />
            <Label x={lx} y={ly} color={lit ? GLOW : MUTED} size={8}>
              L{i + 1}
            </Label>
          </g>
        );
        return lit ? <Pulse key={i}>{door}</Pulse> : door;
      });
      return (
        // undo the shared tilt: this one is already in perspective
        <g transform="translate(160 100) skewX(6) translate(-160 -100)">
          {/* floor edges, ceiling edges and the far wall */}
          <polyline points={quad([wall(-1, 0, 0), wall(-1, 1, 0), wall(1, 1, 0), wall(1, 0, 0)])} fill="none" stroke={LINE} strokeWidth="2" />
          <polyline points={quad([wall(-1, 0, 1), wall(-1, 1, 1), wall(1, 1, 1), wall(1, 0, 1)])} fill="none" stroke={LINE} strokeWidth="1.5" />
          <line x1={wall(-1, 1, 0)[0]} y1={wall(-1, 1, 0)[1]} x2={wall(-1, 1, 1)[0]} y2={wall(-1, 1, 1)[1]} stroke={LINE} strokeWidth="1.5" />
          <line x1={wall(1, 1, 0)[0]} y1={wall(1, 1, 0)[1]} x2={wall(1, 1, 1)[0]} y2={wall(1, 1, 1)[1]} stroke={LINE} strokeWidth="1.5" />
          {doors}
          <rect x={78} y={170} width={164} height={22} rx={4} fill="#0B1220" stroke={GLOW} strokeWidth="1" />
          <Label x={160} y={185} color={GLOW} size={10}>
            {all ? "ANY LIFT · PRESS ▲▼" : `LIFT ${d.highlight + 1}`}
          </Label>
        </g>
      );
    }

    case "turn": {
      const path = d.dir === "left" ? "M160 180 L160 100 L60 100" : d.dir === "right" ? "M160 180 L160 100 L260 100" : "M160 180 L160 30";
      return (
        <>
          <path d="M130 200 L130 120 L20 120 M190 200 L190 120 L300 120 M20 80 L130 80 L130 10 M190 10 L190 80 L300 80" fill="none" stroke={LINE} strokeWidth="2" />
          <Pulse>
            <path d={path} fill="none" stroke={GLOW} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" filter={glow} markerEnd={arrow} />
          </Pulse>
          {d.sign && (
            <g>
              <rect x={d.dir === "left" ? 14 : 156} y={28} width={150} height={32} rx={3} fill="#2A2410" stroke="#FFC15E" strokeWidth="1.5" />
              <Label x={d.dir === "left" ? 89 : 231} y={48} color="#FFC15E" size={9}>
                {d.sign} {d.dir === "left" ? "←" : "→"}
              </Label>
            </g>
          )}
        </>
      );
    }

    case "lift-ride": {
      const floors = ["9", "7", "5", "3", "1", "B2"];
      const up = floors.indexOf(d.to) < floors.indexOf(d.from);
      return (
        <>
          <rect x={60} y={14} width={90} height={172} rx={8} fill="none" stroke={LINE} strokeWidth="2" />
          {floors.map((f, i) => {
            const y = 34 + i * 28;
            const target = f === d.to;
            const here = f === d.from;
            const button = (
              <g key={f}>
                <circle cx={105} cy={y} r={11} fill="none" stroke={target ? GLOW : here ? MUTED : LINE} strokeWidth={target ? 3 : 1.5} filter={target ? glow : undefined} />
                <Label x={105} y={y + 4} color={target ? GLOW : here ? "#E6F1F5" : MUTED} size={9}>
                  {f}
                </Label>
              </g>
            );
            return target ? <Pulse key={f}>{button}</Pulse> : button;
          })}
          <Pulse>
            <path d={up ? "M220 160 L220 50" : "M220 50 L220 160"} stroke={GLOW} strokeWidth="5" strokeLinecap="round" filter={glow} markerEnd={arrow} />
          </Pulse>
          <Label x={250} y={up ? 40 : 182} color={GLOW} size={14}>
            {d.to === "B2" ? "B2" : `F${d.to}`}
          </Label>
          <Label x={250} y={up ? 182 : 40} size={10}>
            {d.from === "B2" ? "B2" : `F${d.from}`}
          </Label>
        </>
      );
    }

    case "door":
      return (
        <>
          <line x1="20" y1="170" x2="300" y2="170" stroke={LINE} strokeWidth="2" />
          <Pulse>
            <path d="M120 170 L120 50 L200 50 L200 170" fill="none" stroke={GLOW} strokeWidth="4" filter={glow} />
          </Pulse>
          <path d="M160 190 L160 120" stroke={GLOW} strokeWidth="4" strokeLinecap="round" markerEnd={arrow} />
          {d.label && (
            <Label x={160} y={36} color={GLOW}>
              {d.label}
            </Label>
          )}
        </>
      );

    case "walk":
      return (
        <>
          <path d="M40 190 L130 40 M280 190 L190 40 M130 40 L190 40" fill="none" stroke={LINE} strokeWidth="2" />
          <Pulse>
            <path d="M160 180 L160 70" stroke={GLOW} strokeWidth="5" strokeLinecap="round" filter={glow} markerEnd={arrow} />
          </Pulse>
          {d.label && (
            <Label x={160} y={28} color={GLOW}>
              {d.label}
            </Label>
          )}
        </>
      );

    case "stairs":
    case "half-stairs": {
      const half = d.kind === "half-stairs";
      const n = half ? 5 : 8;
      const side = half ? d.side : "right";
      const steps = Array.from({ length: n }, (_, i) => {
        const x = side === "left" ? 140 - i * 16 : 180 + i * 16;
        const y = d.dir === "up" ? 160 - i * 14 : 90 + i * 14;
        return `${i === 0 ? "M" : "L"}${x} ${y} L${x + (side === "left" ? -16 : 16)} ${y}`;
      }).join(" ");
      // dashed arrow from where you stand along the stairs, in the direction you walk
      const sx = side === "left" ? 140 : 180;
      const ex = side === "left" ? 140 - n * 16 : 180 + n * 16;
      const [y0, y1] = d.dir === "up" ? [175, 175 - n * 14] : [75, 75 + n * 14];
      const arrowPath = `M${side === "left" ? sx + 14 : sx - 14} ${y0} L${ex} ${y1}`;
      return (
        <>
          {half && <path d="M160 200 L160 20" stroke={LINE} strokeWidth="2" strokeDasharray="6 6" />}
          <Pulse>
            <path d={steps} fill="none" stroke={GLOW} strokeWidth="4" strokeLinejoin="round" filter={glow} />
          </Pulse>
          <path d={arrowPath} fill="none" stroke={GLOW} strokeWidth="2.5" strokeDasharray="4 5" markerEnd={arrow} />
          <Label x={160} y={190} color={GLOW}>
            {half ? `½ FLIGHT ${d.dir.toUpperCase()} · ${side.toUpperCase()}` : `${d.dir.toUpperCase()} ${d.floors} FLOOR${d.floors > 1 ? "S" : ""}`}
          </Label>
        </>
      );
    }

    case "cube":
      return (
        <>
          <path d="M40 80 L290 80 M40 130 L290 130" stroke={LINE} strokeWidth="2" />
          {[1, 2, 3, 4].map((n) => {
            const x = 40 + n * 55;
            const lit = n === d.door;
            const y = n % 2 ? 50 : 130;
            const door = (
              <g key={n}>
                <rect x={x - 14} y={y} width={28} height={30} rx={2} fill="none" stroke={lit ? GLOW : LINE} strokeWidth={lit ? 3 : 1.5} filter={lit ? glow : undefined} />
                <Label x={x} y={n % 2 ? 42 : 176} color={lit ? GLOW : MUTED} size={lit ? 12 : 9}>
                  {lit ? d.label : n}
                </Label>
              </g>
            );
            return lit ? <Pulse key={n}>{door}</Pulse> : door;
          })}
          <path d="M20 105 L245 105" stroke={GLOW} strokeWidth="4" strokeLinecap="round" filter={glow} markerEnd={arrow} />
        </>
      );

    case "arrive":
      return (
        <>
          <Pulse>
            <circle cx={160} cy={95} r={60} fill="none" stroke={GLOW} strokeWidth="1.5" opacity="0.5" />
            <circle cx={160} cy={95} r={40} fill="none" stroke={GLOW} strokeWidth="2" filter={glow} />
          </Pulse>
          {d.target === "car" ? (
            <path d="M135 105 L140 88 L180 88 L185 105 L185 115 L135 115 Z M143 115 v6 M177 115 v6" fill="none" stroke={GLOW} strokeWidth="3" strokeLinejoin="round" filter={glow} />
          ) : (
            <Label x={160} y={101} color={GLOW} size={16}>
              {d.label.replace(/^Room /, "")}
            </Label>
          )}
          <Label x={160} y={186} color={GLOW}>
            {d.target === "car" ? "YOUR CAR" : "ARRIVED"}
          </Label>
        </>
      );
  }
}

function describe(d: Diagram): string {
  switch (d.kind) {
    case "lifts":
      return d.highlight < 0 ? "Lift lobby, any lift" : `Lift lobby, lift ${d.highlight + 1} highlighted`;
    case "turn":
      return `Turn ${d.dir}`;
    case "lift-ride":
      return `Lift from ${d.from} to ${d.to}`;
    case "door":
      return `Doorway ${d.label ?? ""}`;
    case "walk":
      return `Walk straight ${d.label ?? ""}`;
    case "stairs":
      return `Stairs ${d.dir} ${d.floors} floors`;
    case "half-stairs":
      return `Half flight ${d.dir} on the ${d.side}`;
    case "cube":
      return `Cube corridor, door ${d.door} is ${d.label}`;
    case "arrive":
      return `Arrived at ${d.label}`;
  }
}
