"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CaptureButton from "@/components/CaptureButton";
import HudPanel from "@/components/HudPanel";
import { addFloor, getBuilding, type Building, type Floor } from "@/lib/buildings";

type Loaded = { building: Building; floors: Floor[]; mine: boolean };

/** One building: its floors in order, each with its uploaded plan, and a form to add the next floor. */
export default function BuildingView() {
  const id = useSearchParams().get("id") ?? "";
  const [data, setData] = useState<Loaded | null | "missing">(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [plan, setPlan] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

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

          {data.floors.length === 0 && <p className="text-sm text-muted">No floors yet. Add the lowest floor first.</p>}
          {data.floors.map((f) => (
            <HudPanel key={f.id} className="flex flex-col gap-2">
              <h2 className="font-hud text-xs tracking-[0.2em] text-muted">FLOOR {f.label.toUpperCase()}</h2>
              {/* eslint-disable-next-line @next/next/no-img-element -- stored data URL plan */}
              <img src={f.image} alt={`Floor ${f.label} plan`} className="w-full rounded-xl border border-edge bg-white object-contain" />
            </HudPanel>
          ))}

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
