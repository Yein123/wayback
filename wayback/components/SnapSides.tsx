"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import CaptureButton from "@/components/CaptureButton";

/** Four-side capture: turn on the spot and snap each way. */
export const SIDES = [
  { name: "FRONT", hint: "Face the way you're heading (or your car's nose)." },
  { name: "RIGHT", hint: "Turn right a quarter turn." },
  { name: "BACK", hint: "Turn right again: face behind you." },
  { name: "LEFT", hint: "One more quarter turn right." },
];

/**
 * The four side slots, the snap button for the next side, and an optional action (e.g. "match now").
 * `marks` can put a small status under each slot (e.g. "SAVED").
 */
export default function SnapSides({
  prompt,
  shots,
  onShot,
  action,
  marks,
  footer,
}: {
  prompt: string;
  shots: File[];
  onShot: (file: File) => void;
  action?: { label: string; onClick: () => void };
  marks?: (string | undefined)[];
  footer?: ReactNode;
}) {
  const side = SIDES[shots.length];
  // One preview URL per photo, released when the photos change or the screen closes.
  const previews = useMemo(() => shots.map((f) => URL.createObjectURL(f)), [shots]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  return (
    <section className="flex flex-1 flex-col items-center gap-5">
      <p className="text-center text-sm text-muted">{prompt}</p>
      <div className="grid w-full grid-cols-4 gap-2">
        {SIDES.map((s, i) => (
          <figure key={s.name} className="flex flex-col items-center gap-1">
            <div
              className={`aspect-square w-full overflow-hidden rounded-xl border ${i === shots.length ? "border-glow shadow-glow" : "border-edge"}`}
            >
              {shots[i] && (
                // eslint-disable-next-line @next/next/no-img-element -- local camera photo
                <img src={previews[i]} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <figcaption className={`font-hud text-[10px] tracking-widest ${i === shots.length ? "text-glow" : "text-muted"}`}>
              {marks?.[i] ?? s.name}
            </figcaption>
          </figure>
        ))}
      </div>
      {side && (
        <>
          <CaptureButton label={`Snap ${side.name.toLowerCase()}`} onPhoto={onShot} />
          <p className="text-center text-sm text-ink">{side.hint}</p>
        </>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="rounded-2xl border border-edge px-5 py-3 font-hud text-xs tracking-widest text-muted active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
      {footer}
    </section>
  );
}
