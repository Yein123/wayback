"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CaptureButton from "@/components/CaptureButton";
import HudPanel from "@/components/HudPanel";
import OutlineEditor, { KIND_COLOR } from "@/components/OutlineEditor";
import { addFloor, getBuilding, saveFloorShape, type Building, type Floor } from "@/lib/buildings";

// three.js only downloads on this screen, and never runs on the server.
const BuildingModel3D = dynamic(() => import("@/components/BuildingModel3D"), {
  ssr: false,
  loading: () => <p className="p-6 font-hud text-xs tracking-widest text-muted">LOADING 3D…</p>,
});

type Loaded = { building: Building; floors: Floor[]; mine: boolean };

/**
 * One building, two views at once: the 3D building on top (for navigating), and below it the 2D plan
 * of the chosen floor (the uploaded plan, for drawing shapes and surveying). Choosing a floor in either
 * one switches both.
 */
export default function BuildingView() {
  const id = useSearchParams().get("id") ?? "";
  const [data, setData] = useState<Loaded | null | "missing">(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [plan, setPlan] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  // Floor in focus in 3D (null = all floors); the 2D plan shows the last floor picked.
  const [focus, setFocus] = useState<number | null>(null);
  const [picked, setPicked] = useState(0);

  function pick(i: number | null) {
    setFocus(i);
    if (i !== null) {
      setPicked(i);
      setEditing(false);
    }
  }

  const load = useCallback(() => {
    getBuilding(id)
      .then((d) => setData(d ?? "missing"))
      .catch((err: Error) => setError(err.message));
  }, [id]);

  useEffect(load, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !plan) return;
    setSaving(true);
    setError(null);
    try {
      await addFloor(id, label, plan);
      setLabel("");
      setPlan(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex items-center justify-between">
        <Link href="/buildings" className="font-hud text-xs tracking-widest text-muted">
          ‹ BUILDINGS
        </Link>
        <span className="font-hud text-xs tracking-[0.2em] text-glow">BUILDING</span>
      </header>

      {data === null && !error && <p className="text-sm text-muted">Loading…</p>}
      {data === "missing" && <p className="text-sm text-amber">This building doesn&apos;t exist.</p>}

      {data && data !== "missing" && (
        <>
          <h1 className="font-hud text-xl font-bold tracking-wider text-glow">{data.building.name.toUpperCase()}</h1>

          {data.floors.length === 0 ? (
            <p className="text-sm text-muted">No floors yet. Add the lowest floor first.</p>
          ) : (
            <>
              <div className="relative -mx-4 h-[46dvh] min-h-72 overflow-hidden border-y border-edge bg-void">
                <BuildingModel3D floors={data.floors} focus={focus} onFocus={pick} />
                <p className="pointer-events-none absolute bottom-2 left-3 font-hud text-[10px] tracking-[0.2em] text-muted">
                  3D · DRAG TO SPIN · PINCH TO ZOOM
                </p>
              </div>

              {(() => {
                const f = data.floors[Math.min(picked, data.floors.length - 1)];
                return (
                  <HudPanel className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-hud text-xs tracking-[0.2em] text-muted">
                        2D PLAN · FLOOR {f.label.toUpperCase()}
                        {f.outlines.length > 0 && ` · ${f.outlines.length} SHAPES`}
                      </h2>
                      {data.mine && !editing && (
                        <button type="button" onClick={() => setEditing(true)} className="font-hud text-[10px] tracking-widest text-glow">
                          EDIT SHAPES ›
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 font-hud text-[10px] tracking-widest">
                      {data.floors.map((fl, i) => (
                        <button
                          key={fl.id}
                          type="button"
                          onClick={() => pick(i)}
                          className={`rounded-lg border px-2 py-1 ${fl.id === f.id ? "border-glow bg-glow/20 text-glow" : "border-edge text-muted"}`}
                        >
                          {fl.label.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    {editing ? (
                      <OutlineEditor
                        key={f.id}
                        floor={f}
                        onSave={async (shape) => {
                          await saveFloorShape(id, f.id, shape);
                          load();
                        }}
                        onClose={() => setEditing(false)}
                      />
                    ) : (
                      <PlanView floor={f} />
                    )}
                  </HudPanel>
                );
              })()}
            </>
          )}

          {data.mine ? (
            <form onSubmit={add}>
              <HudPanel tone="violet" className="flex flex-col gap-3">
                <h2 className="font-hud text-xs tracking-[0.2em] text-muted">ADD THE NEXT FLOOR</h2>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={12}
                  placeholder="Floor label, e.g. B2, G, 1"
                  autoComplete="off"
                  className="rounded-xl border border-edge bg-void px-4 py-3 font-hud tracking-widest text-glow outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted focus:border-glow"
                />
                <div className="flex items-center gap-3">
                  <CaptureButton size="small" fromGallery label={plan ? "Plan chosen ✓" : "Choose plan image"} onPhoto={setPlan} />
                  <button
                    type="submit"
                    disabled={!label.trim() || !plan || saving}
                    className="flex-1 rounded-xl border border-glow bg-glow/15 py-2.5 font-hud text-xs tracking-[0.2em] text-glow disabled:opacity-40"
                  >
                    {saving ? "UPLOADING…" : "ADD FLOOR"}
                  </button>
                </div>
              </HudPanel>
            </form>
          ) : (
            <p className="text-xs text-muted">Only the person who added this building can change it.</p>
          )}
        </>
      )}

      {error && <p className="text-sm text-amber">{error}</p>}
    </main>
  );
}

/** A floor's uploaded plan with its shapes drawn over it (read-only). */
function PlanView({ floor }: { floor: Floor }) {
  const u = Math.max(floor.width, floor.height) / 300;
  return (
    <svg viewBox={`0 0 ${floor.width} ${floor.height}`} className="w-full rounded-xl border border-edge bg-white" role="img" aria-label={`Floor ${floor.label} plan`}>
      <image href={floor.image} x={0} y={0} width={floor.width} height={floor.height} />
      {floor.outlines.map((o, i) => (
        <polygon
          key={i}
          points={o.points.map((p) => p.join(",")).join(" ")}
          fill={KIND_COLOR[o.kind]}
          fillOpacity={0.25}
          stroke={KIND_COLOR[o.kind]}
          strokeWidth={u * 0.5}
        />
      ))}
    </svg>
  );
}
