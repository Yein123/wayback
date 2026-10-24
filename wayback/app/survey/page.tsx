"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FloorPlanPicker, { type Pin } from "@/components/FloorPlanPicker";
import CaptureButton from "@/components/CaptureButton";
import HudPanel from "@/components/HudPanel";
import SnapSides, { SIDES } from "@/components/SnapSides";
import { cubes, LIFT_FLOORS, roomNumber } from "@/lib/building";
import { compassName, latLngName, useCompass } from "@/lib/compass";
import { getGps, type Gps } from "@/lib/gps";
import { getSpot } from "@/lib/map";
import { ensureRoomNumbers } from "@/lib/roomNumbers";
import RoomNumberEditor from "@/components/RoomNumberEditor";
import SavedSurvey from "@/components/SavedSurvey";
import { groupSurvey, listSurvey, surveyAccess, uploadShot, type SurveyPlace } from "@/lib/survey";

type Access = { state: "checking" } | { state: "denied"; uid: string } | { state: "ok" } | { state: "error"; message: string };

/**
 * Survey mode: walk the building, and at each spot pin where you stand on the floor plan,
 * read GPS, and snap the four sides. Every photo uploads as soon as it's taken.
 */
export default function SurveyPage() {
  const [access, setAccess] = useState<Access>({ state: "checking" });
  const [floor, setFloor] = useState("5");
  const [pin, setPin] = useState<Pin | null>(null);
  const [gps, setGps] = useState<Gps | null | "reading">(null);
  const [shots, setShots] = useState<File[]>([]);
  const [marks, setMarks] = useState<(string | undefined)[]>([]);
  const [saved, setSaved] = useState(0);
  const [exporting, setExporting] = useState(false);
  // Everything surveyed so far, loaded when "View saved" is opened.
  const [places, setPlaces] = useState<SurveyPlace[] | "loading" | "failed" | null>(null);
  const compass = useCompass();
  // A note on one side of the spot, with an optional photo.
  const [noteSide, setNoteSide] = useState(SIDES[0].name);
  const [noteText, setNoteText] = useState("");
  const [notePhoto, setNotePhoto] = useState<File | null>(null);
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  // Room numbers already fixed at the door; `numbers` re-renders once they're in.
  const [numbers, setNumbers] = useState(0);
  useEffect(() => {
    void ensureRoomNumbers().then(() => setNumbers((n) => n + 1));
  }, []);

  useEffect(() => {
    surveyAccess()
      .then((a) => setAccess(a.allowed ? { state: "ok" } : { state: "denied", uid: a.uid }))
      .catch((err: Error) => setAccess({ state: "error", message: err.message }));
  }, []);

  async function readGps() {
    setGps("reading");
    setGps(await getGps(10_000));
  }

  function choosePin(p: Pin) {
    setPin(p);
    void readGps();
  }

  /** Where the pin is, plus GPS and which way the phone faces right now. */
  function where(side: string, note: string) {
    return {
      spotId: pin!.spot?.id ?? null,
      floor,
      pos: pin!.pos,
      level: pin!.level,
      cube: pin!.cube ?? null,
      side,
      heading: compass.heading === null ? null : Math.round(compass.heading),
      gps: gps === "reading" ? null : gps,
      note,
    };
  }

  async function shoot(file: File) {
    if (!pin) return;
    const i = shots.length;
    setShots([...shots, file]);
    setMarks((m) => Object.assign([...m], { [i]: "SAVING" }));
    try {
      await uploadShot(where(SIDES[i].name, ""), file);
      setMarks((m) => Object.assign([...m], { [i]: "SAVED" }));
      setSaved((n) => n + 1);
    } catch {
      setMarks((m) => Object.assign([...m], { [i]: "FAILED" }));
    }
  }

  async function saveNote() {
    if (!pin || (!noteText.trim() && !notePhoto)) return;
    setNoteState("saving");
    try {
      await uploadShot(where(noteSide, noteText.trim()), notePhoto);
      setNoteState("saved");
      setNoteText("");
      setNotePhoto(null);
      setSaved((n) => n + 1);
    } catch {
      setNoteState("failed");
    }
  }

  function nextSpot() {
    setPin(null);
    setShots([]);
    setMarks([]);
    setGps(null);
    setNoteText("");
    setNotePhoto(null);
    setNoteState("idle");
  }

  async function exportPack() {
    setExporting(true);
    try {
      const all = await listSurvey();
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), shots: all })], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `wayback-survey-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  }

  async function toggleSaved() {
    if (places !== null && places !== "failed") return setPlaces(null);
    setPlaces("loading");
    try {
      setPlaces(groupSurvey(await listSurvey()));
    } catch {
      setPlaces("failed");
    }
  }

  const gpsGood = gps && gps !== "reading" && gps.accuracy <= 20;
  const savedHere = Array.isArray(places) ? places.filter((p) => p.floor === floor).map((p) => p.pos) : [];

  return (
    <main className="flex flex-1 flex-col gap-5">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-hud text-xs tracking-widest text-muted">
          ‹ HOME
        </Link>
        <span className="font-hud text-xs tracking-[0.2em] text-glow">SURVEY · {saved} SAVED</span>
      </header>

      {access.state === "checking" && <p className="text-sm text-muted">Checking survey access…</p>}
      {access.state === "error" && <p className="text-sm text-amber">Couldn&apos;t reach Firebase: {access.message}</p>}
      {access.state === "denied" && (
        <HudPanel tone="amber" className="flex flex-col gap-3">
          <p className="font-hud text-sm tracking-widest text-amber">NOT A SURVEYOR YET</p>
          <p className="text-sm text-muted">Send this surveyor ID so this phone can be allowed to upload survey photos:</p>
          <p className="select-all break-all rounded-lg border border-edge bg-void p-3 font-mono text-sm text-ink">{access.uid}</p>
        </HudPanel>
      )}

      {access.state === "ok" && (
        <>
          <HudPanel className="flex flex-col gap-3">
            <h2 className="font-hud text-xs tracking-[0.2em] text-muted">1 · WHERE ARE YOU STANDING?</h2>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {LIFT_FLOORS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setFloor(f);
                    setPin(null);
                  }}
                  className={`shrink-0 rounded-lg border px-2.5 py-1 font-hud text-xs ${f === floor ? "border-glow bg-glow/20 text-glow" : "border-edge text-muted"}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <FloorPlanPicker key={floor} floor={floor} pin={pin} onPin={choosePin} saved={savedHere} />
            <p className="text-sm text-ink">
              {!pin
                ? "Tap your position on the plan."
                : pin.spot
                  ? `Pinned: ${pin.spot.label}`
                  : pin.cube
                    ? `In the ${pin.cube.hallway} ${pin.cube.stair === 2 || pin.cube.stair === 3 ? "upper" : "lower"} cube (stair ${pin.cube.stair})${pin.cube.room ? `, room ${pinRoom(floor, pin.cube)?.number}` : ", corridor"}`
                    : `New place on floor ${floor} at ${pin.pos[0]}, ${pin.pos[1]} m`}
            </p>
            {pin?.cube?.room && pinRoom(floor, pin.cube) && (
              <RoomNumberEditor
                key={`${pinRoom(floor, pin.cube)!.id} ${numbers}`}
                roomId={pinRoom(floor, pin.cube)!.id}
                number={pinRoom(floor, pin.cube)!.number}
                onSaved={() => setNumbers((n) => n + 1)}
              />
            )}
          </HudPanel>

          {pin && (
            <HudPanel className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-hud text-xs tracking-[0.2em] text-muted">2 · GPS</h2>
                <p className={`text-sm ${gpsGood ? "text-glow" : "text-amber"}`}>
                  {gps === "reading"
                    ? "Reading…"
                    : gps
                      ? `±${Math.round(gps.accuracy)} m ${gpsGood ? "· good for pinning" : "· too rough to pin (still saved)"}`
                      : "No GPS fix here (fine indoors / underground)"}
                </p>
                {gps && gps !== "reading" && <p className="font-mono text-xs text-ink">{latLngName(gps.lat, gps.lng)}</p>}
                <p className="font-mono text-xs text-muted">
                  {compass.heading !== null ? `Facing ${compassName(compass.heading)}` : compass.needsPermission ? "Compass off" : "No compass on this device"}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <button type="button" onClick={readGps} className="rounded-lg border border-edge px-3 py-1.5 font-hud text-[10px] tracking-widest text-muted">
                  READ AGAIN
                </button>
                {compass.needsPermission && (
                  <button type="button" onClick={compass.enable} className="rounded-lg border border-glow/60 px-3 py-1.5 font-hud text-[10px] tracking-widest text-glow">
                    COMPASS ON
                  </button>
                )}
              </div>
            </HudPanel>
          )}

          {pin && (
            <HudPanel className="flex flex-col gap-3">
              <h2 className="font-hud text-xs tracking-[0.2em] text-muted">3 · SNAP THE FOUR SIDES</h2>
              <SnapSides
                prompt="Each photo uploads as soon as you take it."
                shots={shots}
                onShot={shoot}
                marks={marks}
                action={shots.length > 0 ? { label: "NEXT SPOT ›", onClick: nextSpot } : undefined}
              />
            </HudPanel>
          )}

          {pin && (
            <HudPanel className="flex flex-col gap-3">
              <h2 className="font-hud text-xs tracking-[0.2em] text-muted">4 · NOTE ON A SIDE (OPTIONAL)</h2>
              <div className="grid grid-cols-4 gap-1.5">
                {SIDES.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setNoteSide(s.name)}
                    className={`rounded-lg border py-1.5 font-hud text-[10px] tracking-widest ${noteSide === s.name ? "border-glow bg-glow/20 text-glow" : "border-edge text-muted"}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <textarea
                value={noteText}
                onChange={(e) => {
                  setNoteText(e.target.value);
                  setNoteState("idle");
                }}
                maxLength={500}
                rows={3}
                placeholder={`What's on the ${noteSide.toLowerCase()} side? e.g. "shoe rack, F6-26 is the middle door"`}
                className="rounded-xl border border-edge bg-void px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-glow"
              />
              <div className="flex items-center gap-3">
                <CaptureButton size="small" label={notePhoto ? "Photo added ✓" : "Add photo (optional)"} onPhoto={setNotePhoto} />
                <button
                  type="button"
                  onClick={saveNote}
                  disabled={(!noteText.trim() && !notePhoto) || noteState === "saving"}
                  className="flex-1 rounded-xl border border-glow bg-glow/15 py-2.5 font-hud text-xs tracking-[0.2em] text-glow disabled:opacity-40"
                >
                  {noteState === "saving" ? "SAVING…" : noteState === "saved" ? "SAVED ✓ · ADD ANOTHER" : noteState === "failed" ? "FAILED · TRY AGAIN" : "SAVE NOTE"}
                </button>
              </div>
            </HudPanel>
          )}

          <button
            type="button"
            onClick={toggleSaved}
            disabled={places === "loading"}
            className="rounded-2xl border border-violet/60 py-3 font-hud text-xs tracking-[0.2em] text-violet disabled:opacity-50"
          >
            {places === "loading" ? "LOADING…" : places === "failed" ? "COULDN'T LOAD · TRY AGAIN" : places ? "HIDE SAVED" : "VIEW SAVED PLACES"}
          </button>
          {Array.isArray(places) && (
            <HudPanel tone="violet" className="flex flex-col gap-3">
              <h2 className="font-hud text-xs tracking-[0.2em] text-muted">
                SAVED · {places.length} PLACES · {places.reduce((n, p) => n + p.shots.length, 0)} SHOTS
              </h2>
              <p className="text-xs text-muted">Violet rings on the plan above mark this floor&apos;s saved places.</p>
              <SavedSurvey places={places} floor={floor} />
            </HudPanel>
          )}

          <button
            type="button"
            onClick={exportPack}
            disabled={exporting}
            className="rounded-2xl border border-violet/60 bg-violet/10 py-3 font-hud text-xs tracking-[0.2em] text-violet disabled:opacity-50"
          >
            {exporting ? "PREPARING…" : "DOWNLOAD IMPORT PACK (LAPTOP)"}
          </button>
        </>
      )}
    </main>
  );
}

/** The pinned room's map spot and door number (as fixed at the door, else worked out from the layout). */
function pinRoom(floor: string, at: NonNullable<Pin["cube"]>): { id: string; number: string } | null {
  const cube = cubes(floor).find((c) => c.hallway === at.hallway && c.side === at.side && c.stair === at.stair);
  if (!cube || !at.room) return null;
  const id = `room-${roomNumber(floor, cube, at.room).toLowerCase()}`;
  return { id, number: getSpot(id)?.room ?? roomNumber(floor, cube, at.room) };
}
