"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CaptureButton from "@/components/CaptureButton";
import HudPanel from "@/components/HudPanel";
import ModelStatusLine from "@/components/ModelStatusLine";
import { getSpot } from "@/lib/map";
import { matchPhoto } from "@/lib/matcher";
import { clearPendingPhoto, peekPendingPhoto } from "@/lib/pendingPhoto";
import type { SpotGuess } from "@/lib/scoring";

type Mode = "park" | "car" | "help";

type Step =
  | { kind: "snap" }
  | { kind: "working"; photoUrl: string }
  | { kind: "result"; photoUrl: string; guesses: SpotGuess[] }
  | { kind: "confirmed"; guess: SpotGuess }
  | { kind: "error"; message: string };

const prompts: Record<Mode, string> = {
  park: "Snap your parking spot's surroundings.",
  car: "Snap where you are now.",
  help: "Snap where you are now.",
};

export default function LocateFlow() {
  const router = useRouter();
  const mode = (useSearchParams().get("mode") as Mode | null) ?? "park";
  // A photo handed over from Home starts straight in the "working" step.
  const [handedOver] = useState(peekPendingPhoto);
  const [step, setStep] = useState<Step>(() =>
    handedOver ? { kind: "working", photoUrl: URL.createObjectURL(handedOver) } : { kind: "snap" },
  );

  const runMatch = useCallback(async (file: File, photoUrl: string) => {
    try {
      const guesses = await matchPhoto(file);
      setStep({ kind: "result", photoUrl, guesses });
    } catch (err) {
      setStep({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const locate = useCallback(
    (file: File) => {
      const photoUrl = URL.createObjectURL(file);
      setStep({ kind: "working", photoUrl });
      void runMatch(file, photoUrl);
    },
    [runMatch],
  );

  const started = useRef(false);
  useEffect(() => {
    if (started.current || !handedOver || step.kind !== "working") return;
    started.current = true;
    clearPendingPhoto();
    void runMatch(handedOver, step.photoUrl);
  }, [handedOver, step, runMatch]);

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-hud text-xs tracking-widest text-muted">
          ‹ HOME
        </Link>
        <span className="font-hud text-xs tracking-[0.2em] text-glow">LOCATE</span>
      </header>

      {step.kind === "snap" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-4">
          <CaptureButton label="Snap" onPhoto={locate} />
          <p className="text-center text-sm text-muted">{prompts[mode]}</p>
          <ModelStatusLine />
        </section>
      )}

      {step.kind === "working" && (
        <section className="flex flex-col items-center gap-4">
          <div className="relative w-full overflow-hidden rounded-2xl border border-glow shadow-glow">
            {/* eslint-disable-next-line @next/next/no-img-element -- local camera photo */}
            <img src={step.photoUrl} alt="Your photo" className="aspect-[3/4] w-full object-cover opacity-70" />
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="h-1/3 w-full animate-scan bg-gradient-to-b from-transparent via-glow/30 to-transparent" />
            </div>
          </div>
          <p className="font-hud text-sm tracking-[0.2em] text-glow">SCANNING…</p>
          <ModelStatusLine />
        </section>
      )}

      {step.kind === "result" && (
        <Result
          step={step}
          onConfirm={(guess) => {
            if (mode === "park") router.push(`/destination?from=${guess.spotId}`);
            else setStep({ kind: "confirmed", guess });
          }}
        />
      )}

      {step.kind === "confirmed" && (
        <HudPanel className="text-center">
          <p className="font-hud text-lg tracking-[0.2em] text-glow">SPOT LOCKED.</p>
          <p className="mt-2 text-sm text-ink">{getSpot(step.guess.spotId)?.label}</p>
        </HudPanel>
      )}

      {step.kind === "error" && (
        <HudPanel tone="amber" className="flex flex-col gap-3">
          <p className="font-hud text-sm tracking-widest text-amber">SCAN FAILED</p>
          <p className="text-sm text-muted">{step.message}</p>
          <CaptureButton size="small" label="Try again" onPhoto={locate} />
        </HudPanel>
      )}
    </main>
  );
}

function Result({
  step,
  onConfirm,
}: {
  step: { photoUrl: string; guesses: SpotGuess[] };
  onConfirm: (guess: SpotGuess) => void;
}) {
  const top = step.guesses[0];
  const spot = getSpot(top.spotId);

  return (
    <section className="flex flex-col gap-4">
      <p className="font-hud text-xs tracking-[0.2em] text-muted">BEST MATCH</p>
      <HudPanel className="flex flex-col gap-4">
        <h2 className="font-hud text-xl font-bold tracking-wider text-glow drop-shadow-[0_0_8px_rgba(62,230,242,0.6)]">
          {spot?.label.toUpperCase() ?? top.spotId}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <figure className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- local camera photo */}
            <img src={step.photoUrl} alt="Your photo" className="aspect-[3/4] w-full rounded-xl border border-edge object-cover" />
            <figcaption className="font-hud text-[10px] tracking-widest text-muted">YOUR PHOTO</figcaption>
          </figure>
          <figure className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- static reference photo */}
            <img
              src={`/reference/${top.file}`}
              alt={spot?.label}
              className="aspect-[3/4] w-full rounded-xl border border-glow object-cover shadow-glow"
            />
            <figcaption className="font-hud text-[10px] tracking-widest text-glow">
              MATCHED · {Math.round(top.score * 100)}%
            </figcaption>
          </figure>
        </div>
      </HudPanel>
      <button
        type="button"
        onClick={() => onConfirm(top)}
        className="rounded-2xl border border-glow bg-glow/15 py-4 font-hud text-lg tracking-[0.3em] text-glow shadow-glow active:scale-[0.98]"
      >
        ✓ CONFIRM
      </button>
    </section>
  );
}
