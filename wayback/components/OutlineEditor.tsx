"use client";

import { useRef, useState } from "react";
import type { Floor } from "@/lib/buildings";
import { metresPerPixel, OUTLINE_KINDS, polygonArea, type Outline, type OutlineKind, type Point } from "@/lib/outline";

export const KIND_COLOR: Record<OutlineKind, string> = {
  hallway: "#3EE6F2",
  lobby: "#5FD6FF",
  room: "#46D9A0",
  toilet: "#8FA1AD",
  lift: "#FFC15E",
  stairs: "#9B7BFF",
  other: "#E6F1F5",
};

type Shape = { metresPerPixel: number | null; scaleLine: [Point, Point] | null; outlines: Outline[] };

/**
 * Over a floor's plan: set the scale (tap two points, type the metres between them), then draw
 * shapes by tapping their corners and closing them. Saves through `onSave`.
 */
export default function OutlineEditor({ floor, onSave, onClose }: { floor: Floor; onSave: (shape: Shape) => Promise<void>; onClose: () => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [mode, setMode] = useState<"scale" | "draw">(floor.metresPerPixel ? "draw" : "scale");
  const [kind, setKind] = useState<OutlineKind>("hallway");
  const [scaleLine, setScaleLine] = useState<Point[]>(floor.scaleLine ?? []);
  const [metres, setMetres] = useState("");
  const [mpp, setMpp] = useState<number | null>(floor.metresPerPixel);
  const [outlines, setOutlines] = useState<Outline[]>(floor.outlines);
  const [drawing, setDrawing] = useState<Point[]>([]);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  // Marks and lines are drawn in plan pixels, so size them to the plan.
  const u = Math.max(floor.width, floor.height) / 300;

  function tap(e: React.PointerEvent<SVGSVGElement>) {
    const ctm = svg.current?.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const pt: Point = [Math.round(p.x), Math.round(p.y)];
    setState("idle");
    if (mode === "scale") setScaleLine((l) => (l.length >= 2 ? [pt] : [...l, pt]));
    else {
      // Tapping near the first corner closes the shape.
      if (drawing.length >= 3 && Math.hypot(pt[0] - drawing[0][0], pt[1] - drawing[0][1]) < u * 4) return closeShape();
      setDrawing((d) => [...d, pt]);
    }
  }

  function applyScale() {
    if (scaleLine.length !== 2) return;
    const value = metresPerPixel(scaleLine[0], scaleLine[1], Number(metres));
    if (!value) return;
    setMpp(value);
    setMode("draw");
  }

  function closeShape() {
    if (drawing.length < 3) return;
    setOutlines((o) => [...o, { kind, points: drawing }]);
    setDrawing([]);
  }

  async function save() {
    setState("saving");
    try {
      await onSave({ metresPerPixel: mpp, scaleLine: scaleLine.length === 2 ? [scaleLine[0], scaleLine[1]] : null, outlines });
      setState("saved");
    } catch {
      setState("failed");
    }
  }

  const area = (o: Outline) => (mpp ? `${Math.round(polygonArea(o.points) * mpp * mpp)} m²` : "no scale");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex overflow-hidden rounded-lg border border-edge font-hud text-[10px] tracking-widest">
        {(["scale", "draw"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 py-1.5 ${mode === m ? "bg-glow/20 text-glow" : "text-muted"}`}>
            {m === "scale" ? `1 · SCALE${mpp ? " ✓" : ""}` : "2 · DRAW SHAPES"}
          </button>
        ))}
      </div>

      {mode === "scale" ? (
        <p className="text-sm text-ink">Tap two points you know the real distance between (e.g. the ends of a wall), then type the metres.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {OUTLINE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className="rounded-lg border px-2 py-1 font-hud text-[10px] tracking-widest"
                style={{ borderColor: k === kind ? KIND_COLOR[k] : "#1E2D42", color: k === kind ? KIND_COLOR[k] : "#8FA1AD" }}
              >
                {k.toUpperCase()}
              </button>
            ))}
          </div>
          <p className="text-sm text-ink">Tap each corner of the {kind}, then tap the first corner (or Close) to finish it.</p>
        </>
      )}

      <svg
        ref={svg}
        viewBox={`0 0 ${floor.width} ${floor.height}`}
        onPointerDown={tap}
        className="w-full touch-none rounded-xl border border-edge bg-white"
        role="img"
        aria-label={`Floor ${floor.label} plan`}
      >
        <image href={floor.image} x={0} y={0} width={floor.width} height={floor.height} />
        {outlines.map((o, i) => (
          <polygon
            key={i}
            points={o.points.map((p) => p.join(",")).join(" ")}
            fill={KIND_COLOR[o.kind]}
            fillOpacity={0.3}
            stroke={KIND_COLOR[o.kind]}
            strokeWidth={u * 0.6}
          />
        ))}
        {drawing.length > 0 && (
          <g>
            <polyline points={drawing.map((p) => p.join(",")).join(" ")} fill="none" stroke={KIND_COLOR[kind]} strokeWidth={u * 0.8} strokeDasharray={`${u * 2} ${u}`} />
            {drawing.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={i === 0 ? u * 2 : u * 1.2} fill={KIND_COLOR[kind]} />
            ))}
          </g>
        )}
        {scaleLine.length > 0 && mode === "scale" && (
          <g>
            {scaleLine.length === 2 && (
              <line x1={scaleLine[0][0]} y1={scaleLine[0][1]} x2={scaleLine[1][0]} y2={scaleLine[1][1]} stroke="#FF3B6B" strokeWidth={u} />
            )}
            {scaleLine.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={u * 1.6} fill="#FF3B6B" />
            ))}
          </g>
        )}
      </svg>

      {mode === "scale" ? (
        <div className="flex gap-2">
          <input
            value={metres}
            onChange={(e) => setMetres(e.target.value)}
            inputMode="decimal"
            placeholder="Metres between the two points"
            className="flex-1 rounded-xl border border-edge bg-void px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-glow"
          />
          <button
            type="button"
            onClick={applyScale}
            disabled={scaleLine.length !== 2 || !(Number(metres) > 0)}
            className="rounded-xl border border-glow bg-glow/15 px-4 font-hud text-xs tracking-widest text-glow disabled:opacity-40"
          >
            SET
          </button>
        </div>
      ) : (
        <div className="flex gap-2 font-hud text-[10px] tracking-widest">
          <button type="button" onClick={() => setDrawing((d) => d.slice(0, -1))} disabled={!drawing.length} className="rounded-lg border border-edge px-3 py-1.5 text-muted disabled:opacity-40">
            UNDO POINT
          </button>
          <button type="button" onClick={closeShape} disabled={drawing.length < 3} className="rounded-lg border border-edge px-3 py-1.5 text-muted disabled:opacity-40">
            CLOSE SHAPE
          </button>
        </div>
      )}

      {outlines.length > 0 && (
        <ul className="flex flex-col gap-1">
          {outlines.map((o, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span style={{ color: KIND_COLOR[o.kind] }}>
                {o.kind} · {area(o)}
              </span>
              <button type="button" onClick={() => setOutlines((all) => all.filter((_, j) => j !== i))} className="font-hud text-[10px] tracking-widest text-muted">
                REMOVE
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="rounded-xl border border-edge px-4 py-2.5 font-hud text-xs tracking-widest text-muted">
          DONE
        </button>
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="flex-1 rounded-xl border border-glow bg-glow/15 py-2.5 font-hud text-xs tracking-[0.2em] text-glow disabled:opacity-40"
        >
          {state === "saving" ? "SAVING…" : state === "saved" ? "SAVED ✓" : state === "failed" ? "FAILED · TRY AGAIN" : "SAVE OUTLINES"}
        </button>
      </div>
      {!mpp && <p className="text-xs text-amber">Without a scale, the 3D view guesses the size.</p>}
    </div>
  );
}
