import HudPanel from "@/components/HudPanel";
import { formatTime } from "@/components/ParkingCard";
import type { Parking } from "@/lib/parkings";

/** Earlier parkings, newest first. View-only. */
export default function HistoryList({ history }: { history: Parking[] }) {
  return (
    <HudPanel tone="violet" className="flex flex-col gap-3">
      <h2 className="font-hud text-xs tracking-[0.2em] text-muted">PARKING HISTORY</h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted">No trips yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- stored data URL thumbnail */}
              <img src={p.thumb} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-edge object-cover" />
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{p.label}</p>
                <p className="text-xs text-muted">{formatTime(p.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </HudPanel>
  );
}
