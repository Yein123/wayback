"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import HudPanel from "@/components/HudPanel";
import RouteSim, { type SimView } from "@/components/RouteSim";
import StepDiagram from "@/components/StepDiagram";
import { getSpot, map } from "@/lib/map";
import { endParking } from "@/lib/parkings";
import { floorChange, shortestPath, toSteps, type Step } from "@/lib/route";
import { endTrip, setStepIndex, startTrip, useTrip } from "@/lib/trip";
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
  const [full, setFull] = useState(false);
  // After a lift or stairs step, Next first asks you to confirm the floor (the app can't sense a lift ride).
  const [askFloor, setAskFloor] = useState(false);

  // Leaving the phone's real full screen (back gesture, Esc) also leaves ours.
  useEffect(() => {
    const sync = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

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
    setAskFloor(false);
    setStepIndex(index);
  }

  const newFloor = floorChange(step);

  function next() {
    if (newFloor && !askFloor) setAskFloor(true);
    else go(stepIndex + 1);
  }

  function toggleFull() {
    const next = !full;
    setFull(next);
    // Real full screen hides the browser bars where it's supported (not iPhone Safari); the layout works without it.
    if (next) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  async function finish() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    // Back at the car: the parking moves to history and the Home card empties.
    if (trip?.mode === "toCar" && trip.parkingId) await endParking(trip.parkingId);
    endTrip();
    router.push("/");
  }

  // The way back: from wherever you are on this route to the car park the trip started from.
  const here = walked >= stepIndex ? step.to : step.from;
  function backToCar() {
    const carPark = trip!.from;
    const path = shortestPath(here, carPark);
    if (!path) return;
    setPlaying(false);
    setWalked(-1);
    startTrip({
      mode: "toCar",
      from: here,
      to: carPark,
      steps: toSteps(path, { target: "car", label: getSpot(carPark)!.label }, carPark),
    });
  }

  const carButton = trip.mode === "toRoom" && canSim && here !== trip.from && (
    <button
      type="button"
      onClick={backToCar}
      className="rounded-lg border border-violet/60 bg-violet/10 px-2.5 py-1 font-hud text-[10px] tracking-widest text-violet active:scale-[0.98]"
    >
      ↩ CAR PARK
    </button>
  );

  const progress =`${isLast ? "ARRIVED" : `≈ ${minutesLeft} MIN LEFT`} · STEP ${stepIndex + 1}/${steps.length}`;

  const floorName = newFloor ? (newFloor.startsWith("B") ? newFloor : `FLOOR ${newFloor}`) : "";

  const controls = askFloor ? (
    <div className="mt-auto flex flex-col gap-3">
      <p className="text-center font-hud text-sm tracking-[0.2em] text-glow">ON {floorName} NOW?</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push("/locate?mode=help")}
          className="rounded-2xl border border-amber/60 px-4 py-4 font-hud text-xs tracking-widest text-amber active:scale-[0.98]"
        >
          NOT SURE · SNAP
        </button>
        <button
          type="button"
          onClick={() => go(stepIndex + 1)}
          className="flex-1 rounded-2xl border border-glow bg-glow/15 py-4 font-hud text-lg tracking-[0.3em] text-glow shadow-glow active:scale-[0.98]"
        >
          YES ›
        </button>
      </div>
    </div>
  ) : (
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
      {!isLast && (
        <button
          type="button"
          onClick={() => router.push("/locate?mode=help")}
          aria-label="I'm lost: find where I am"
          className="rounded-2xl border border-amber/60 px-4 py-4 font-hud text-sm tracking-widest text-amber active:scale-[0.98]"
        >
          ?
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
          onClick={next}
          className="flex-1 rounded-2xl border border-glow bg-glow/15 py-4 font-hud text-lg tracking-[0.3em] text-glow shadow-glow active:scale-[0.98]"
        >
          NEXT ›
        </button>
      )}
    </div>
  );

  return (
    <main className="flex flex-1 flex-col gap-4">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-hud text-xs tracking-widest text-muted">
          ‹ HOME
        </Link>
        <span className="font-hud text-xs tracking-[0.2em] text-glow">
          {trip.mode === "toCar" ? "TO YOUR CAR" : "TO YOUR ROOM"}
        </span>
        {carButton}
      </header>

      {canSim ? (
        <div
          className={
            full
              ? "fixed inset-0 z-50 h-dvh overflow-hidden bg-void"
              : "relative -mx-4 h-[56dvh] min-h-80 overflow-hidden border-y border-edge bg-void"
          }
        >
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
            <button
              type="button"
              onClick={toggleFull}
              aria-label={full ? "Leave full screen" : "Full screen"}
              className={`border-l border-edge px-2.5 py-1 ${full ? "bg-glow/20 text-glow" : "text-muted"}`}
            >
              {full ? "✕" : "⛶"}
            </button>
          </div>
          {full ? (
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-void via-void/90 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10">
              <div className="flex items-center justify-between">
                <p className="font-hud text-[10px] tracking-[0.2em] text-muted">{progress}</p>
                {carButton}
              </div>
              <p className="text-lg leading-snug text-ink">{step.text}</p>
              {controls}
            </div>
          ) : (
            <p className="pointer-events-none absolute bottom-2 left-3 font-hud text-[10px] tracking-[0.2em] text-muted">{progress}</p>
          )}
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

      {!full && controls}
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
