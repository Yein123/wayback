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
import { getSpot, map } from "@/lib/map";
import { matchPhotos } from "@/lib/matcher";
import { readSign } from "@/lib/readSign";
import { liftFloorFor, mergeReads, type SignRead } from "@/lib/signText";
import { getCurrentParking, saveParking } from "@/lib/parkings";
import { findRoom, shortestPath, toSteps } from "@/lib/route";
import { currentTrip, startTrip } from "@/lib/trip";
import { clearPendingPhoto, peekPendingPhoto } from "@/lib/pendingPhoto";
import type { SpotGuess } from "@/lib/scoring";

type Mode = "park" | "car" | "help" | "where";

type Step =
  | { kind: "snap"; shots: File[] }
  | { kind: "working"; photoUrl: string; reading?: boolean }
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
  // Bumped by a retry, so reads from the photos before it don't land on the new result.
  const round = useRef(0);
  // Shows the matched result once; set while the signs are still being read.
  const showResult = useRef<(() => void) | null>(null);

  const runMatch = useCallback(async (shots: File[]) => {
    const photoUrl = URL.createObjectURL(shots[0]);
    setStep({ kind: "working", photoUrl });
    gps.current ??= getGps();
    try {
      const guesses = await matchPhotos(shots, await gps.current);
      const mine = round.current;
      const result = { kind: "result" as const, photoUrl, file: shots[0], guesses };
      // The sign says where better than the photo, so the result waits for the reading (or a skip).
      showResult.current = () => {
        showResult.current = null;
        setStep(result);
      };
      setSign("reading");
      setStep({ kind: "working", photoUrl, reading: true });
      const done = mergeReads(await Promise.all(reads.current));
      if (round.current !== mine) return;
      setSign(done);
      showResult.current?.();
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
        {mode === "help" && currentTrip() ? (
          <Link href="/directions" className="font-hud text-xs tracking-widest text-glow">
            ‹ BACK TO ROUTE
          </Link>
        ) : (
          <Link href="/" className="font-hud text-xs tracking-widest text-muted">
            ‹ HOME
          </Link>
        )}
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
          <p className="font-hud text-sm tracking-[0.2em] text-glow">{step.reading ? "READING SIGNS…" : "SCANNING…"}</p>
          {step.reading ? (
            <button type="button" onClick={() => showResult.current?.()} className="font-hud text-[10px] tracking-widest text-violet">
              DON&apos;T WAIT · SHOW THE PHOTO MATCH
            </button>
          ) : (
            <ModelStatusLine />
          )}
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
          onRetry={() => {
            round.current++;
            showResult.current = null;
            reads.current = [];
            setSign(null);
            setStep({ kind: "snap", shots: [] });
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

/** The lift floor a spot is reached from (cubes half a floor up go with the lobby below). */
function liftOf(spotId: string): string | undefined {
  const floor = getSpot(spotId)?.floor;
  return floor === undefined || isNaN(Number(floor)) ? floor : liftFloorFor(Number(floor));
}

/** Where a cube's board hangs: the hallway at the foot of its half-flight of stairs. */
function boardSpot(cube: string): string | null {
  const id = `cube-${cube.toLowerCase()}`;
  if (!getSpot(id)) return null;
  return map.links.find((l) => l.from === id && l.diagram.kind === "half-stairs")?.to ?? id;
}

/** A typed place: a room number ("F6-26"), or a lift floor ("5", "B2") for its lobby. */
function typedSpot(text: string): string | null {
  const floor = text.trim().toUpperCase().replace(/^(LOBBY|FLOOR|ARAS|LEVEL)\s*/, "");
  if (LIFT_FLOORS.includes(floor) && getSpot(`lobby-${floor.toLowerCase()}`)) return `lobby-${floor.toLowerCase()}`;
  return findRoom(text);
}

function Result({
  step,
  sign,
  onSignPhoto,
  onConfirm,
  onRetry,
}: {
  step: { photoUrl: string; guesses: SpotGuess[] };
  sign: SignRead | "reading" | null;
  onSignPhoto: (file: File) => void;
  onConfirm: (guess: SpotGuess) => void;
  onRetry: () => void;
}) {
  const top = step.guesses[0];
  const read = sign && sign !== "reading" ? sign : null;
  // The sign wins over the photo match: a door number or a cube's board pins the spot.
  const signSpot = read?.room ? findRoom(read.room) : read?.cube ? boardSpot(read.cube) : null;
  const noSign = !!read && !read.floor && !read.cube && !read.room;
  const [useSign, setUseSign] = useState(true);
  // Every floor's lift lobby looks the same (and GPS can't tell floors), so a lobby match takes the floor
  // from the ARAS sign, or asks.
  const atLifts = getSpot(top.spotId)?.type === "lobby";
  const [picked, setPicked] = useState<string | null>(null);
  const floor = picked ?? read?.floor ?? getSpot(top.spotId)?.floor ?? "1";
  // A floor sign elsewhere: the best match on that floor, or that floor's lobby (where the ARAS signs hang).
  const onSignFloor =
    read?.floor && !atLifts && liftOf(top.spotId) !== read.floor
      ? (step.guesses.find((g) => liftOf(g.spotId) === read.floor) ?? { ...top, spotId: `lobby-${read.floor.toLowerCase()}` })
      : null;
  const matched = atLifts ? { ...top, spotId: `lobby-${floor.toLowerCase()}` } : (onSignFloor ?? top);
  // Typed in by hand: wins over everything.
  const [typed, setTyped] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [unknown, setUnknown] = useState<string | null>(null);
  const fromSign = !typed && !!signSpot && useSign;
  const chosen = typed ? { ...top, spotId: typed } : fromSign ? { ...top, spotId: signSpot } : matched;
  const spot = getSpot(chosen.spotId);
  // Confirming while a sign is still being read waits for it: a door plate or board read moves the start there.
  const [waiting, setWaiting] = useState(false);
  const confirmed = useRef(false);
  const signDone = sign !== "reading";
  const chosenId = chosen.spotId;
  useEffect(() => {
    if (!waiting || !signDone || confirmed.current) return;
    confirmed.current = true;
    onConfirm({ ...top, spotId: chosenId });
  }, [waiting, signDone, chosenId, top, onConfirm]);

  function setPlace(e: React.FormEvent) {
    e.preventDefault();
    const id = typedSpot(text);
    if (!id) return setUnknown(text.trim());
    setTyped(id);
    setUnknown(null);
    setText("");
  }

  const yourPhoto = (
    <figure className="flex flex-col gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- local camera photo */}
      <img src={step.photoUrl} alt="Your photo" className="aspect-[3/4] w-full rounded-xl border border-edge object-cover" />
      <figcaption className="font-hud text-[10px] tracking-widest text-muted">YOUR PHOTO</figcaption>
    </figure>
  );

  return (
    <section className="flex flex-col gap-4">
      <p className="font-hud text-xs tracking-[0.2em] text-muted">
        {typed
          ? "YOU SET"
          : fromSign
            ? "READ FROM THE SIGN"
            : onSignFloor
              ? "MATCHED ON THE SIGN'S FLOOR"
              : noSign
                ? "NO SIGN READ · MATCHED BY PHOTO"
                : "BEST MATCH"}
      </p>
      <HudPanel className="flex flex-col gap-4">
        <h2 className="font-hud text-xl font-bold tracking-wider text-glow drop-shadow-[0_0_8px_rgba(62,230,242,0.6)]">
          {spot?.label.toUpperCase() ?? chosen.spotId}
        </h2>
        {fromSign && read?.cube && !read.room && (
          <p className="-mt-2 text-sm text-muted">By the board for {getSpot(`cube-${read.cube.toLowerCase()}`)?.label}, at the foot of its stairs.</p>
        )}
        {fromSign || typed ? (
          // the sign (or you) said where; a lookalike reference photo would only confuse
          <div className="mx-auto w-1/2">{yourPhoto}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {yourPhoto}
            <figure className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- static reference photo */}
              <img
                src={`/reference/${top.file}`}
                alt={getSpot(top.spotId)?.label}
                className="aspect-[3/4] w-full rounded-xl border border-glow object-cover shadow-glow"
              />
              <figcaption className="font-hud text-[10px] tracking-widest text-glow">
                MATCHED · {Math.round(top.score * 100)}%
              </figcaption>
            </figure>
          </div>
        )}
      </HudPanel>
      {sign === "reading" && <p className="font-hud text-[10px] tracking-[0.2em] text-muted">READING SIGNS…</p>}
      {read && read.seen.length > 0 && (
        <HudPanel className="flex flex-col gap-2">
          <p className="font-hud text-[10px] tracking-[0.2em] text-muted">SIGN SAYS</p>
          <p className="font-hud text-sm tracking-widest text-glow">{read.seen.slice(0, 4).join(" · ")}</p>
          {signSpot && !typed && (
            <button type="button" onClick={() => setUseSign(!useSign)} className="self-start font-hud text-[10px] tracking-widest text-violet">
              {useSign ? "USE THE PHOTO MATCH INSTEAD" : `USE THE SIGN: ${getSpot(signSpot)?.label.toUpperCase()}`}
            </button>
          )}
        </HudPanel>
      )}
      {atLifts && !fromSign && !typed && (
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
        disabled={waiting}
        onClick={() => (sign === "reading" && !typed ? setWaiting(true) : onConfirm(chosen))}
        className="rounded-2xl border border-glow bg-glow/15 py-4 font-hud text-lg tracking-[0.3em] text-glow shadow-glow active:scale-[0.98] disabled:opacity-60"
      >
        {waiting ? "READING THE SIGN…" : "✓ CONFIRM"}
      </button>
      {waiting ? (
        <button type="button" onClick={() => onConfirm(matched)} className="self-center font-hud text-[10px] tracking-widest text-violet">
          DON&apos;T WAIT · USE THE PHOTO MATCH
        </button>
      ) : (
        <HudPanel className="flex flex-col gap-3">
          <p className="font-hud text-[10px] tracking-[0.2em] text-muted">NOT HERE?</p>
          <form onSubmit={setPlace} className="flex gap-2">
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setUnknown(null);
              }}
              placeholder="Room (F6-26) or lift floor (5)"
              aria-label="Where you are"
              autoComplete="off"
              autoCapitalize="characters"
              className="min-w-0 flex-1 rounded-xl border border-edge bg-void px-3 py-2 font-hud text-sm tracking-widest text-glow outline-none placeholder:font-sans placeholder:text-xs placeholder:tracking-normal placeholder:text-muted focus:border-glow"
            />
            <button type="submit" disabled={!text.trim()} className="rounded-xl border border-glow px-4 font-hud text-xs tracking-widest text-glow disabled:opacity-40">
              SET
            </button>
          </form>
          {unknown && <p className="text-sm text-amber">Wayback doesn&apos;t know {unknown}. Try a room number like F6-26.</p>}
          <button type="button" onClick={onRetry} className="self-start font-hud text-[10px] tracking-widest text-violet">
            ↻ RETRY MATCHING
          </button>
        </HudPanel>
      )}
    </section>
  );
}
