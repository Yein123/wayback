"use client";

import { latLngName } from "@/lib/compass";
import { map } from "@/lib/map";
import type { SurveyPlace } from "@/lib/survey";

/** Everything surveyed so far, one card per place: where it is, its GPS reading, and its photos. */
export default function SavedSurvey({ places, floor }: { places: SurveyPlace[]; floor: string }) {
  if (places.length === 0) return <p className="text-sm text-muted">Nothing surveyed yet.</p>;
  // This floor's places first, so they line up with the rings on the plan above.
  const sorted = [...places].sort((a, b) => Number(b.floor === floor) - Number(a.floor === floor));
  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((p) => {
        const label = p.spotId ? (map.spots.find((s) => s.id === p.spotId)?.label ?? p.spotId) : `New place at ${p.pos[0]}, ${p.pos[1]} m`;
        const good = p.gps && p.gps.accuracy <= 20;
        const notes = p.shots.filter((s) => s.note);
        return (
          <li key={p.key} className={`flex flex-col gap-2 rounded-xl border p-3 ${p.floor === floor ? "border-violet/60" : "border-edge"}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm text-ink">{label}</p>
              <span className="shrink-0 font-hud text-[10px] tracking-widest text-muted">FLOOR {p.floor}</span>
            </div>
            <p className={`font-mono text-xs ${good ? "text-glow" : "text-amber"}`}>
              {p.gps
                ? `${latLngName(p.gps.lat, p.gps.lng)} · ±${Math.round(p.gps.accuracy)} m${good ? "" : " (too rough to pin)"}`
                : "No GPS reading"}
            </p>
            <div className="flex gap-1.5 overflow-x-auto">
              {p.shots
                .filter((s) => s.photo)
                .map((s) => (
                  <figure key={s.id} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL from Firestore */}
                    <img src={s.photo!} alt={`${s.side} side`} className="h-16 w-16 rounded-lg border border-edge object-cover" />
                    <figcaption className="text-center font-hud text-[9px] tracking-widest text-muted">{s.side}</figcaption>
                  </figure>
                ))}
            </div>
            {notes.map((s) => (
              <p key={s.id} className="text-xs text-muted">
                <span className="font-hud tracking-widest">{s.side}:</span> {s.note}
              </p>
            ))}
            {p.last && <p className="text-[10px] text-muted">Last saved {new Date(p.last).toLocaleString()}</p>}
          </li>
        );
      })}
    </ul>
  );
}
