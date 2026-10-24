"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CaptureButton from "@/components/CaptureButton";
import HudPanel from "@/components/HudPanel";
import ModelStatusLine from "@/components/ModelStatusLine";
import SnapSides, { SIDES } from "@/components/SnapSides";
import { getGps, type Gps } from "@/lib/gps";
import { makeThumb } from "@/lib/image";
import { LIFT_FLOORS } from "@/lib/building";
import { getSpot } from "@/lib/map";
import { matchPhotos } from "@/lib/matcher";
import { readSign } from "@/lib/readSign";
import { mergeReads, type SignRead } from "@/lib/signText";
import { getCurrentParking, saveParking } from "@/lib/parkings";
import { findRoom, shortestPath, toSteps } from "@/lib/route";
import { currentTrip, startTrip } from "@/lib/trip";
import { clearPendingPhoto, peekPendingPhoto } from "@/lib/pendingPhoto";
import type { SpotGuess } from "@/lib/scoring";

type Mode = "park" | "car" | "help" | "where";

type Step =
  | { kind: "snap"; shots: File[] }
  | { kind: "working"; photoUrl: string }
  | { kind: "result"; photoUrl: string; file: File; guesses: SpotGuess[] }
  | { kind: "saving" }
  | { kind: "confirmed"; guess: SpotGuess }
  | { kind: "error"; message: string };

const prompts: Record<Mode, string> = {
  park: "Snap around your parking spot.",
  car: "Snap around where you are now. A sign or room number in a photo helps.",
  help: "Snap around where you are now. A sign or room number in a photo helps.",
  where: "Snap around where you are now. A sign or room number in a photo helps.",
};

export default function LocateFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = (params.get("mode") as Mode | null) ?? "park";
  // Where to?: the destination was chosen first.
  const whereTo = params.get("to");
  // A photo handed over from Home is the FRONT shot; the other sides are taken here.
  const [handedOver] = useState(peekPendingPhoto);
  const [step, setStep] = useState<Step>(() => ({ kind: "snap", shots: handedOver ? [handedOver] : [] }));

  // GPS is asked for at the first shot, so it's ready by the time the photos are matched.
  const gps = useRef<Promise<Gps | null> | null>(null);
  // The words in each photo (signs, room numbers), read beside the photo match.
  const reads = useRef<Promise<SignRead>[]>([]);
  const [sign, setSign] = useState<SignRead | "reading" | null>(null);

  const runMatch = useCallback(async (shots: File[]) => {
    const photoUrl = URL.createObjectURL(shots[0]);
    setStep({ kind: "working", photoUrl });
    gps.current ??= getGps();
    try {
      const guesses = await matchPhotos(shots, await gps.current);
      setStep({ kind: "result", photoUrl, file: shots[0], guesses });
      // Each photo's words show as soon as that photo is read; "reading" until the first one is.
      setSign("reading");
      const done: SignRead[] = [];
      for (const read of reads.current)
        void read.then((r) => {
          done.push(r);
          if (r.seen.length || done.length === reads.current.length) setSign(mergeReads(done));
        });
    } catch (err) {
      setStep({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const addShot = useCallback(
    (shots: File[], file: File) => {
      gps.current ??= getGps();
      if (shots.length === 0) reads.current = [];
      reads.current.push(readSign(file));
      const next = [...shots, file];
      if (next.length === SIDES.length) void runMatch(next);
      else setStep({ kind: "snap", shots: next });
    },
    [runMatch],
  );

  // Find my car: from the confirmed spot to the saved parking.
  async function routeToCar(here: string) {
    setStep({ kind: "saving" });
    try {
      const parking = await getCurrentParking();
      if (!parking) throw new Error("No parking is saved. Capture your parking spot first.");
      go(here, parking.spotId, "toCar", parking.id);
    } catch (err) {
      setStep({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  // Help: fresh steps from the confirmed spot to the trip's same destination.
  function reroute(here: string) {
    const trip = currentTrip();
    if (!trip) return setStep({ kind: "error", message: "There's no route in progress to get back on." });
    go(here, trip.to, trip.mode, trip.parkingId);
  }

  function go(here: string, to: string, tripMode: "toRoom" | "toCar", parkingId?: string) {
    const path = here === to ? [] : shortestPath(here, to);
    if (!path) return setStep({ kind: "error", message: "Wayback can't find a way from there yet." });
    const target = tripMode === "toCar" ? "car" : "room";
    startTrip({ mode: tripMode, from: here, to, parkingId, steps: toSteps(path, { target, label: getSpot(to)?.label ?? to }, to) });
    router.push("/directions");
  }

  useEffect(() => {
    if (!handedOver) return;
    clearPendingPhoto();
    gps.current ??= getGps();
    reads.current = [readSign(handedOver)];
  }, [handedOver]);

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-hud text-xs tracking-widest text-muted">
          ‹ HOME
        </Link>
        <span className="font-hud text-xs tracking-[0.2em] text-glow">LOCATE</span>
      </header>

      {step.kind === "snap" && (
        <SnapSides
          prompt={prompts[mode]}
          shots={step.shots}
          onShot={(f) => addShot(step.shots, f)}
          action={step.shots.length > 0 ? { label: `SKIP THE REST · MATCH ${step.shots.length}/${SIDES.length}`, onClick: () => runMatch(step.shots) } : undefined}
          footer={<ModelStatusLine />}
        />
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
          sign={sign}
          onSignPhoto={async (file) => {
            const before = sign;
            setSign("reading");
            const read = await readSign(file);
            setSign(mergeReads(before && before !== "reading" ? [read, before] : [read]));
          }}
          onConfirm={async (guess) => {
            if (mode === "car") return routeToCar(guess.spotId);
            if (mode === "help") return reroute(guess.spotId);
            if (mode === "where") return whereTo ? go(guess.spotId, whereTo, "toRoom") : setStep({ kind: "confirmed", guess });
            setStep({ kind: "saving" });
            try {
              const [thumb, fix] = await Promise.all([makeThumb(step.file), gps.current ?? Promise.resolve(null)]);
              await saveParking({ spotId: guess.spotId, label: getSpot(guess.spotId)?.label ?? guess.spotId, thumb, gps: fix });
              router.push(`/destination?from=${guess.spotId}`);
            } catch (err) {
              setStep({ kind: "error", message: `Couldn't save your parking: ${err instanceof Error ? err.message : String(err)}` });
            }
          }}
        />
      )}

      {step.kind === "saving" && (
        <p className="text-center font-hud text-sm tracking-[0.2em] text-glow">{mode === "park" ? "SAVING YOUR SPOT…" : "PLOTTING YOUR ROUTE…"}</p>
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
          <CaptureButton size="small" label="Try again" onPhoto={(f) => addShot([], f)} />
        </HudPanel>
      )}
    </main>
  );
}

function Result({
  step,
  sign,
  onSignPhoto,
  onConfirm,
}: {
  step: { photoUrl: string; guesses: SpotGuess[] };
  sign: SignRead | "reading" | null;
  onSignPhoto: (file: File) => void;
  onConfirm: (guess: SpotGuess) => void;
}) {
  const top = step.guesses[0];
  const read = sign && sign !== "reading" ? sign : null;
  // A door number or a cube's board pins the spot better than the photo match.
  const signSpot = read?.room ? findRoom(read.room) : read?.cube ? (getSpot(`cube-${read.cube.toLowerCase()}`)?.id ?? null) : null;
  const [useSign, setUseSign] = useState(true);
  // Every floor's lift lobby looks the same (and GPS can't tell floors), so a lobby match takes the floor
  // from the ARAS sign, or asks.
  const atLifts = getSpot(top.spotId)?.type === "lobby";
  const [picked, setPicked] = useState<string | null>(null);
  const floor = picked ?? read?.floor ?? getSpot(top.spotId)?.floor ?? "1";
  const fromSign = !!signSpot && useSign;
  const chosen = fromSign ? { ...top, spotId: signSpot } : atLifts ? { ...top, spotId: `lobby-${floor.toLowerCase()}` } : top;
  const spot = getSpot(chosen.spotId);

  return (
    <section className="flex flex-col gap-4">
      <p className="font-hud text-xs tracking-[0.2em] text-muted">{fromSign ? "READ FROM THE SIGN" : "BEST MATCH"}</p>
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
      {sign === "reading" && <p className="font-hud text-[10px] tracking-[0.2em] text-muted">READING SIGNS…</p>}
      {read && read.seen.length > 0 && (
        <HudPanel className="flex flex-col gap-2">
          <p className="font-hud text-[10px] tracking-[0.2em] text-muted">SIGN SAYS</p>
          <p className="font-hud text-sm tracking-widest text-glow">{read.seen.slice(0, 4).join(" · ")}</p>
          {signSpot && (
            <button type="button" onClick={() => setUseSign(!useSign)} className="self-start font-hud text-[10px] tracking-widest text-violet">
              {useSign ? "USE THE PHOTO MATCH INSTEAD" : `USE THE SIGN: ${getSpot(signSpot)?.label.toUpperCase()}`}
            </button>
          )}
        </HudPanel>
      )}
      {atLifts && !fromSign && (
        <HudPanel tone="amber" className="flex flex-col gap-3">
          <p className="text-sm text-ink">
            {read?.floor && !picked
              ? `The ARAS sign says floor ${read.floor}. Tap another floor if that's wrong.`
              : "The lift lobbies all look alike. Which floor are you on? Tap it, or snap the ARAS sign by the lifts, straight on and close enough to fill a third of the photo."}
          </p>
          <div className="flex gap-1.5">
            {LIFT_FLOORS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setPicked(f)}
                className={`flex-1 rounded-lg border py-2 font-hud text-xs ${f === floor ? "border-glow bg-glow/20 text-glow" : "border-edge text-muted"}`}
              >
                {f}
              </button>
            ))}
          </div>
          {!read?.floor && <CaptureButton size="small" label="Snap the ARAS sign" onPhoto={onSignPhoto} />}
        </HudPanel>
      )}
      <button
        type="button"
        onClick={() => onConfirm(chosen)}
        className="rounded-2xl border border-glow bg-glow/15 py-4 font-hud text-lg tracking-[0.3em] text-glow shadow-glow active:scale-[0.98]"
      >
        ✓ CONFIRM
      </button>
    </section>
  );
}
