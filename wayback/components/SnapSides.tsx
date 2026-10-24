"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import CaptureButton from "@/components/CaptureButton";
import { photoDetail, PLAIN_WALL } from "@/lib/image";

/** Four-side capture: turn on the spot and snap each way. */
export const SIDES = [
  { name: "FRONT", hint: "Face the way you're heading (or your car's nose)." },
  { name: "RIGHT", hint: "Turn right a quarter turn." },
  { name: "BACK", hint: "Turn right again: face behind you." },
  { name: "LEFT", hint: "One more quarter turn right." },
];

/**
 * The four side slots, the snap button for the next side, and an optional action (e.g. "match now").
 * `marks` can put a small status under each slot (e.g. "SAVED"). A photo of mostly plain wall is held
 * back with a tip, since it can't tell one spot from another; it's kept only if you say so.
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
  const [checking, setChecking] = useState(false);
  const [plain, setPlain] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (plain) return () => URL.revokeObjectURL(plain.url);
  }, [plain]);

  async function snap(file: File) {
    setChecking(true);
    // if the check itself fails, the photo is simply used
    const detail = await photoDetail(file).catch(() => Infinity);
    setChecking(false);
    if (detail < PLAIN_WALL) setPlain({ file, url: URL.createObjectURL(file) });
    else onShot(file);
  }

  function useAnyway() {
    if (plain) onShot(plain.file);
    setPlain(null);
  }

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
      {side && plain && (
        <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-amber/60 bg-amber/10 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- local camera photo */}
          <img src={plain.url} alt="" className="h-28 w-28 rounded-xl border border-edge object-cover" />
          <p className="font-hud text-xs tracking-[0.2em] text-amber">MOSTLY PLAIN WALL</p>
          <p className="text-center text-sm text-ink">
            Walls look the same everywhere. Turn a little so a sign board, the stairs or a room number is in the picture.
          </p>
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={useAnyway}
              className="rounded-2xl border border-edge px-4 py-3 font-hud text-xs tracking-widest text-muted active:scale-[0.98]"
            >
              USE ANYWAY
            </button>
            <button
              type="button"
              onClick={() => setPlain(null)}
              className="flex-1 rounded-2xl border border-amber bg-amber/15 py-3 font-hud text-xs tracking-[0.2em] text-amber active:scale-[0.98]"
            >
              RETAKE
            </button>
          </div>
        </div>
      )}
      {side && !plain && (
        <>
          <CaptureButton label={checking ? "Checking…" : `Snap ${side.name.toLowerCase()}`} onPhoto={snap} />
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
