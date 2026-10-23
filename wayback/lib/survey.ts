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
  side: string;
  gps: Gps | null;
  photo: string; // JPEG data URL, ~640px
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

export async function uploadShot(shot: Omit<SurveyShot, "photo">, file: Blob): Promise<void> {
  const { db, user } = await firebase();
  const photo = await toDataUrl(await resizePhoto(file, 640, 0.7));
  await addDoc(collection(db, "survey"), { ...shot, photo, by: user.uid, createdAt: serverTimestamp() });
}

/** Everything surveyed so far, for the import pack. */
export async function listSurvey(): Promise<(SurveyShot & { id: string; createdAt: string | null })[]> {
  const { db } = await firebase();
  const snap = await getDocs(query(collection(db, "survey"), orderBy("createdAt")));
  return snap.docs.map((d) => {
    const v = d.data();
    return { id: d.id, ...(v as SurveyShot), createdAt: v.createdAt?.toDate?.().toISOString() ?? null };
  });
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read photo"));
    reader.readAsDataURL(blob);
  });
}
