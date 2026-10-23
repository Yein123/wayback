"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FloorPlanPicker, { type Pin } from "@/components/FloorPlanPicker";
import HudPanel from "@/components/HudPanel";
import SnapSides, { SIDES } from "@/components/SnapSides";
import { FLOORS } from "@/lib/building";
import { getGps, type Gps } from "@/lib/gps";
import { listSurvey, surveyAccess, uploadShot } from "@/lib/survey";

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

  async function shoot(file: File) {
    if (!pin) return;
    const i = shots.length;
    setShots([...shots, file]);
    setMarks((m) => Object.assign([...m], { [i]: "SAVING" }));
    try {
      await uploadShot(
        { spotId: pin.spot?.id ?? null, floor, pos: pin.pos, side: SIDES[i].name, gps: gps === "reading" ? null : gps },
        file,
      );
      setMarks((m) => Object.assign([...m], { [i]: "SAVED" }));
      setSaved((n) => n + 1);
    } catch {
      setMarks((m) => Object.assign([...m], { [i]: "FAILED" }));
    }
  }

  function nextSpot() {
    setPin(null);
    setShots([]);
    setMarks([]);
    setGps(null);
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

  const gpsGood = gps && gps !== "reading" && gps.accuracy <= 20;

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
              {FLOORS.map((f) => (
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
            <FloorPlanPicker floor={floor} pin={pin} onPin={choosePin} />
            <p className="text-sm text-ink">
              {!pin
                ? "Tap your position on the plan."
                : pin.spot
                  ? `Pinned: ${pin.spot.label}`
                  : `New place on floor ${floor} at ${pin.pos[0]}, ${pin.pos[1]} m`}
            </p>
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
              </div>
              <button type="button" onClick={readGps} className="rounded-lg border border-edge px-3 py-1.5 font-hud text-[10px] tracking-widest text-muted">
                READ AGAIN
              </button>
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
