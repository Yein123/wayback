"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import HudPanel from "@/components/HudPanel";
import StepDiagram from "@/components/StepDiagram";
import { endTrip, setStepIndex, useTrip } from "@/lib/trip";

export default function DirectionsPage() {
  const router = useRouter();
  const trip = useTrip();

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

  function finish() {
    endTrip();
    router.push("/");
  }

  return (
    <main className="flex flex-1 flex-col gap-5">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-hud text-xs tracking-widest text-muted">
          ‹ HOME
        </Link>
        <span className="font-hud text-xs tracking-[0.2em] text-glow">
          {trip.mode === "toCar" ? "TO YOUR CAR" : "TO YOUR ROOM"}
        </span>
      </header>

      <div className="flex items-center gap-1.5">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i < stepIndex ? "bg-glow/50" : i === stepIndex ? "bg-glow shadow-glow" : "bg-edge"}`}
          />
        ))}
      </div>

      <p className="font-hud text-xs tracking-[0.2em] text-muted">
        {isLast ? "DESTINATION" : "NEXT WAYPOINT"} · STEP {stepIndex + 1} / {steps.length}
      </p>

      <HudPanel className="flex flex-col gap-4">
        <StepDiagram diagram={step.diagram} />
        <p className="text-lg leading-snug text-ink">{step.text}</p>
      </HudPanel>

      <div className="mt-auto flex gap-3">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={() => setStepIndex(stepIndex - 1)}
            className="rounded-2xl border border-edge px-5 py-4 font-hud text-sm tracking-widest text-muted active:scale-[0.98]"
          >
            BACK
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
            onClick={() => setStepIndex(stepIndex + 1)}
            className="flex-1 rounded-2xl border border-glow bg-glow/15 py-4 font-hud text-lg tracking-[0.3em] text-glow shadow-glow active:scale-[0.98]"
          >
            NEXT ›
          </button>
        )}
      </div>
    </main>
  );
}
