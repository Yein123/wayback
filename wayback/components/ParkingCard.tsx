import Link from "next/link";
import HudPanel from "@/components/HudPanel";
import type { Parking } from "@/lib/parkings";

/** Home's Current Parking card: the saved spot, or the first-use prompt. */
export default function ParkingCard({ parking, loading }: { parking: Parking | null; loading: boolean }) {
  return (
    <HudPanel className="flex flex-col gap-3">
      <h2 className="font-hud text-xs tracking-[0.2em] text-muted">CURRENT PARKING</h2>
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : parking ? (
        <>
          <div className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- stored data URL thumbnail */}
            <img src={parking.thumb} alt="" className="h-20 w-20 shrink-0 rounded-xl border border-glow object-cover shadow-glow" />
            <div className="flex min-w-0 flex-col justify-center gap-1">
              <p className="font-hud text-sm font-bold tracking-wider text-glow">{parking.label.toUpperCase()}</p>
              <p className="text-xs text-muted">Parked {formatTime(parking.createdAt)}</p>
            </div>
          </div>
          <Link
            href="/locate?mode=car"
            className="rounded-2xl border border-glow bg-glow/15 py-3 text-center font-hud text-sm tracking-[0.3em] text-glow shadow-glow active:scale-[0.98]"
          >
            FIND MY CAR
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted">Tap Capture when you park.</p>
      )}
    </HudPanel>
  );
}

export function formatTime(d: Date | null): string {
  if (!d) return "just now";
  return d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
