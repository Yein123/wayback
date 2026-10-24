// Survey mode: photos of a spot from four sides, its place on the floor plan and a GPS reading,
// uploaded live to Firestore (survey/{id}). `npm run import-survey` turns them into reference photos
// and GPS anchors. Only approved surveyors can read or add (see firestore.rules).
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from "firebase/firestore";
import { firebase } from "@/lib/firebase";
import type { Gps } from "@/lib/gps";
import { resizePhoto } from "@/lib/image";

export type SurveyShot = {
  /** A known map spot, or null for a new place (its pin is kept for adding it to the map). */
  spotId: string | null;
  floor: string;
  pos: [number, number];
  /** Height in floor levels (±0.5 inside a cube). */
  level: number;
  /** When pinned inside a cube: which cube, and the room the pin is in. */
  cube: { hallway: string; side: string; stair: number; room: number | null } | null;
  side: string;
  /** Which way the camera faced, degrees from north, if the phone has a compass. */
  heading: number | null;
  gps: Gps | null;
  note: string;
  photo: string | null; // JPEG data URL, ~640px; a side can be just a note
};

/** This browser's surveyor ID, and whether it's allowed to survey yet. */
export async function surveyAccess(): Promise<{ uid: string; allowed: boolean }> {
  const { db, user } = await firebase();
  try {
    await getDocs(query(collection(db, "survey"), limit(1)));
    return { uid: user.uid, allowed: true };
  } catch {
    return { uid: user.uid, allowed: false };
  }
}

export async function uploadShot(shot: Omit<SurveyShot, "photo">, file: Blob | null): Promise<void> {
  const { db, user } = await firebase();
  const photo = file ? await toDataUrl(await resizePhoto(file, 640, 0.7)) : null;
  await addDoc(collection(db, "survey"), { ...shot, photo, by: user.uid, createdAt: serverTimestamp() });
}

/** Everything surveyed so far, for the import pack. */
export async function listSurvey(): Promise<SavedShot[]> {
  const { db } = await firebase();
  const snap = await getDocs(query(collection(db, "survey"), orderBy("createdAt")));
  return snap.docs.map((d) => {
    const v = d.data();
    return { id: d.id, ...(v as SurveyShot), createdAt: v.createdAt?.toDate?.().toISOString() ?? null };
  });
}

export type SavedShot = SurveyShot & { id: string; createdAt: string | null };

/** One surveyed place: every shot pinned at the same spot (or the same new-place pin) on a floor. */
export type SurveyPlace = {
  key: string;
  spotId: string | null;
  floor: string;
  pos: [number, number];
  shots: SavedShot[];
  /** The most accurate GPS reading taken there, if any. */
  gps: Gps | null;
  last: string | null;
};

/** Groups saved shots into places, newest first. Setup test records are left out, as the import does. */
export function groupSurvey(shots: SavedShot[]): SurveyPlace[] {
  const places = new Map<string, SurveyPlace>();
  for (const s of shots) {
    if (s.note?.startsWith("TEST note")) continue;
    const key = `${s.floor}|${s.spotId ?? s.pos.join(",")}`;
    const p = places.get(key) ?? { key, spotId: s.spotId, floor: s.floor, pos: s.pos, shots: [], gps: null, last: null };
    p.shots.push(s);
    if (s.gps && (!p.gps || s.gps.accuracy < p.gps.accuracy)) p.gps = s.gps;
    if (s.createdAt && (!p.last || s.createdAt > p.last)) p.last = s.createdAt;
    places.set(key, p);
  }
  return [...places.values()].sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""));
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read photo"));
    reader.readAsDataURL(blob);
  });
}
