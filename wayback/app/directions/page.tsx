"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import HudPanel from "@/components/HudPanel";
import RouteSim, { type SimView } from "@/components/RouteSim";
import StepDiagram from "@/components/StepDiagram";
import { map } from "@/lib/map";
import type { Step } from "@/lib/route";
import { endTrip, setStepIndex, useTrip } from "@/lib/trip";
import referencePhotos from "@/public/data/reference-photos.json";

// three.js only downloads on this screen, and never runs on the server.
const Building3D = dynamic(() => import("@/components/Building3D"), {
  ssr: false,
  loading: () => <p className="p-6 font-hud text-xs tracking-widest text-muted">LOADING BUILDING…</p>,
});

export default function DirectionsPage() {
  const router = useRouter();
  const trip = useTrip();
  const [view, setView] = useState<SimView>("3d");
  const [playing, setPlaying] = useState(false);
  const [walked, setWalked] = useState(-1);

  // Play: once the simulated walk of a step finishes, pause a beat and move on to the next one.
  useEffect(() => {
    // BACK and NEXT switch play off, so it only ever runs forward to the arrival step.
    if (!playing || !trip || walked !== trip.stepIndex || trip.stepIndex === trip.steps.length - 1) return;
    const t = setTimeout(() => setStepIndex(trip.stepIndex + 1), 900);
    return () => clearTimeout(t);
  }, [playing, trip, walked]);

  if (trip === undefined) return null;

  if (trip === null) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-muted">No route in progress.</p>
        <Link href="/" className="font-hud text-sm tracking-widest text-glow">
          ‹ HOME
        </Link>
      </main>
    );
  }

  const { steps, stepIndex } = trip;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  // Trips saved before the map had positions have no from/to; they fall back to the step diagrams.
  const canSim = steps.every((s) => s.from && s.to);
  const photo = photoFor(step);
  const minutesLeft = Math.max(1, Math.round(secondsLeft(steps, stepIndex) / 60));

  function go(index: number) {
    setPlaying(false);
    setStepIndex(index);
  }

  function finish() {
    endTrip();
    router.push("/");
  }

  return (
    <main className="flex flex-1 flex-col gap-4">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-hud text-xs tracking-widest text-muted">
          ‹ HOME
        </Link>
        <span className="font-hud text-xs tracking-[0.2em] text-glow">
          {trip.mode === "toCar" ? "TO YOUR CAR" : "TO YOUR ROOM"}
        </span>
      </header>

      {canSim ? (
        <div className="relative -mx-4 h-[56dvh] min-h-80 overflow-hidden border-y border-edge bg-void">
          {view === "3d" ? (
            <Building3D steps={steps} stepIndex={stepIndex} onWalked={setWalked} />
          ) : (
            <RouteSim steps={steps} stepIndex={stepIndex} view="2d" onWalked={setWalked} />
          )}
          <div className="absolute right-3 top-3 flex overflow-hidden rounded-lg border border-edge bg-panel/80 font-hud text-xs tracking-widest">
            {(["2d", "3d"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-2.5 py-1 ${view === v ? "bg-glow/20 text-glow" : "text-muted"}`}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </div>
          <p className="pointer-events-none absolute bottom-2 left-3 font-hud text-[10px] tracking-[0.2em] text-muted">
            {isLast ? "ARRIVED" : `≈ ${minutesLeft} MIN LEFT`} · STEP {stepIndex + 1}/{steps.length}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i < stepIndex ? "bg-glow/50" : i === stepIndex ? "bg-glow shadow-glow" : "bg-edge"}`}
            />
          ))}
        </div>
      )}

      <HudPanel className="flex flex-col gap-3">
        <p className="text-lg leading-snug text-ink">{step.text}</p>
        {photo ? (
          <figure className="flex flex-col gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- local reference photo, no resizing needed */}
            <img src={`/reference/${photo.file}`} alt="" className="h-44 w-full rounded-xl border border-edge object-cover" />
            <figcaption className="font-hud text-[10px] tracking-[0.2em] text-muted">{photo.caption}</figcaption>
          </figure>
        ) : (
          !canSim && <StepDiagram diagram={step.diagram} />
        )}
      </HudPanel>

      <div className="mt-auto flex gap-3">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={() => go(stepIndex - 1)}
            className="rounded-2xl border border-edge px-5 py-4 font-hud text-sm tracking-widest text-muted active:scale-[0.98]"
          >
            BACK
          </button>
        )}
        {canSim && !isLast && (
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? "Pause the simulation" : "Play the whole route"}
            className="rounded-2xl border border-violet/60 px-5 py-4 font-hud text-sm tracking-widest text-violet active:scale-[0.98]"
          >
            {playing ? "❚❚" : "▶"}
          </button>
        )}
        {isLast ? (
          <button
            type="button"
            onClick={finish}
            className="flex-1 rounded-2xl border border-glow bg-glow/15 py-4 font-hud text-lg tracking-[0.3em] text-glow shadow-glow active:scale-[0.98]"
          >
            {trip.mode === "toCar" ? "ARRIVED" : "DONE"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(stepIndex + 1)}
            className="flex-1 rounded-2xl border border-glow bg-glow/15 py-4 font-hud text-lg tracking-[0.3em] text-glow shadow-glow active:scale-[0.98]"
          >
            NEXT ›
          </button>
        )}
      </div>
    </main>
  );
}

/** A real photo for the step: what you'll see when you get there, else where you start from. */
function photoFor(step: Step): { file: string; caption: string } | null {
  const at = (id: string) => referencePhotos.find((p) => p.spotId === id)?.file;
  const ahead = step.to !== step.from ? at(step.to) : undefined;
  if (ahead) return { file: ahead, caption: "LOOK FOR THIS" };
  const here = at(step.from);
  return here ? { file: here, caption: "WHERE YOU START" } : null;
}

function secondsLeft(steps: Step[], stepIndex: number): number {
  return steps
    .slice(stepIndex)
    .reduce((sum, s) => sum + (map.links.find((l) => l.from === s.from && l.to === s.to)?.cost ?? 0), 0);
}
