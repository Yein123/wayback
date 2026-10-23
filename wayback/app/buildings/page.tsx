"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HudPanel from "@/components/HudPanel";
import { createBuilding, listMyBuildings, type Building } from "@/lib/buildings";

/** Your buildings, and a form to add a new one (Wayback for any building). */
export default function BuildingsPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[] | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyBuildings()
      .then(setBuildings)
      .catch((err: Error) => setError(err.message));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const id = await createBuilding(name);
      router.push(`/building?id=${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-hud text-xs tracking-widest text-muted">
          ‹ HOME
        </Link>
        <span className="font-hud text-xs tracking-[0.2em] text-glow">BUILDINGS</span>
      </header>

      <form onSubmit={add} className="flex flex-col gap-3">
        <HudPanel className="flex flex-col gap-3">
          <label htmlFor="name" className="font-hud text-lg tracking-wider text-ink">
            Add a building
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Building name, e.g. Sunway Pyramid"
            autoComplete="off"
            className="rounded-xl border border-edge bg-void px-4 py-3 text-ink outline-none placeholder:text-muted focus:border-glow focus:shadow-glow"
          />
        </HudPanel>
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="rounded-2xl border border-glow bg-glow/15 py-4 font-hud text-sm tracking-[0.3em] text-glow shadow-glow active:scale-[0.98] disabled:opacity-40"
        >
          {saving ? "CREATING…" : "CREATE · THEN ADD FLOORS"}
        </button>
      </form>

      {error && <p className="text-sm text-amber">{error}</p>}

      <HudPanel tone="violet" className="flex flex-col gap-3">
        <h2 className="font-hud text-xs tracking-[0.2em] text-muted">YOUR BUILDINGS</h2>
        {buildings === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : buildings.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {buildings.map((b) => (
              <li key={b.id}>
                <Link href={`/building?id=${b.id}`} className="flex items-center justify-between rounded-xl border border-edge px-3 py-2.5 text-ink">
                  <span>{b.name}</span>
                  <span className="font-hud text-xs text-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </HudPanel>
    </main>
  );
}
