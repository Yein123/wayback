// Room number fixes from the survey: when a door's real number differs from the one worked out from the
// layout, a surveyor saves it (Firestore roomNumbers/{room spot id}) and every phone uses it from then on.
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { firebase } from "@/lib/firebase";
import { map, type DormMap } from "@/lib/map";

export const ROOM_NUMBER = /^F\d{1,2}-\d{2}$/;

/** Puts surveyed numbers on their room spots, and into the steps that lead to them. */
export function renameRooms(target: DormMap, numbers: Record<string, string>): void {
  for (const [id, number] of Object.entries(numbers)) {
    const spot = target.spots.find((s) => s.id === id && s.type === "room");
    if (!spot?.room || !ROOM_NUMBER.test(number)) continue;
    const old = spot.room;
    spot.renamed = true;
    if (old === number) continue;
    spot.room = number;
    spot.label = `Room ${number}`;
    for (const link of target.links) {
      if (link.from !== id && link.to !== id) continue;
      link.instruction = link.instruction.replaceAll(old, number);
      if ("label" in link.diagram && link.diagram.label === old) link.diagram = { ...link.diagram, label: number };
    }
  }
}

let loaded: Promise<void> | null = null;

/** Fetches the surveyed numbers once and applies them to the map (offline, the map keeps its own). */
export function ensureRoomNumbers(): Promise<void> {
  loaded ??= (async () => {
    const { db } = await firebase();
    const snap = await getDocs(collection(db, "roomNumbers"));
    renameRooms(map, Object.fromEntries(snap.docs.map((d) => [d.id, String(d.data().number)])));
  })().catch(() => {
    loaded = null;
  });
  return loaded;
}

/** Saves a door's real number (approved surveyors only) and uses it on this phone straight away. */
export async function saveRoomNumber(roomId: string, number: string): Promise<void> {
  if (!ROOM_NUMBER.test(number)) throw new Error("Room numbers look like F5-03.");
  const { db, user } = await firebase();
  await setDoc(doc(db, "roomNumbers", roomId), { number, by: user.uid, updatedAt: serverTimestamp() });
  renameRooms(map, { [roomId]: number });
}
