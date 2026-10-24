"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import HudPanel from "@/components/HudPanel";
import { getSpot } from "@/lib/map";
import { findRoom, normalizeRoom, shortestPath, toSteps } from "@/lib/route";
import { ensureRoomNumbers } from "@/lib/roomNumbers";
import { startTrip } from "@/lib/trip";

export default function DestinationForm() {
  const router = useRouter();
  const from = useSearchParams().get("from") ?? "";
  const fromSpot = getSpot(from);
  const [room, setRoom] = useState("");
  const [unknown, setUnknown] = useState<string | null>(null);
  useEffect(() => {
    void ensureRoomNumbers();
  }, []);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    // numbers fixed at the door during the survey (a weak signal just means the layout's numbers)
    await Promise.race([ensureRoomNumbers(), new Promise((r) => setTimeout(r, 4000))]);
    const to = findRoom(room);
    const path = to && fromSpot ? shortestPath(from, to) : null;
    if (!to || (fromSpot && !path)) {
      setUnknown(normalizeRoom(room) || room);
      return;
    }
    // Where to? (no start yet): find where you are next, then the route starts from there.
    if (!fromSpot) return router.push(`/locate?mode=where&to=${to}`);
    startTrip({ mode: "toRoom", from, to, steps: toSteps(path!, { target: "room", label: getSpot(to)!.label }, to) });
    router.push("/directions");
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-hud text-xs tracking-widest text-muted">
          ‹ HOME
        </Link>
        <span className="font-hud text-xs tracking-[0.2em] text-glow">DESTINATION</span>
      </header>

      {fromSpot && (
        <p className="font-hud text-[10px] tracking-widest text-muted">
          START · <span className="text-glow">{fromSpot.label.toUpperCase()}</span>
        </p>
      )}

      <form onSubmit={go} className="flex flex-col gap-4">
        <HudPanel className="flex flex-col gap-3">
          <label htmlFor="room" className="font-hud text-lg tracking-wider text-ink">
            Where are you going?
          </label>
          <input
            id="room"
            value={room}
            onChange={(e) => {
              setRoom(e.target.value);
              setUnknown(null);
            }}
            placeholder="Room number, e.g. F6-26"
            autoComplete="off"
            autoCapitalize="characters"
            className="rounded-xl border border-edge bg-void px-4 py-3 font-hud text-xl tracking-widest text-glow outline-none placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-muted focus:border-glow focus:shadow-glow"
          />
          {unknown && (
            <p className="text-sm text-amber">
              Wayback doesn&apos;t know room {unknown} yet. Try another room number.
            </p>
          )}
        </HudPanel>
        <button
          type="submit"
          disabled={!room.trim()}
          className="rounded-2xl border border-glow bg-glow/15 py-4 font-hud text-lg tracking-[0.3em] text-glow shadow-glow active:scale-[0.98] disabled:opacity-40"
        >
          {fromSpot ? "START QUEST" : "NEXT: FIND WHERE I AM"}
        </button>
        {!fromSpot && <p className="text-center text-sm text-muted">Then snap around you, and the route starts from where you are.</p>}
      </form>
    </main>
  );
}
