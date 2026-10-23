// Building Store: any building's floors and their plan images, saved under the person who added them.
// buildings/{id} = { name, owner, createdAt }; buildings/{id}/floors/{floorId} = { label, order, image, width, height }.
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { firebase } from "@/lib/firebase";

export type Building = { id: string; name: string; owner: string; createdAt: Date | null };
export type Floor = { id: string; label: string; order: number; image: string; width: number; height: number };

const MAX_RECORD = 900_000; // a Firestore record must stay under 1 MB

export async function createBuilding(name: string): Promise<string> {
  const { db, user } = await firebase();
  const ref = await addDoc(collection(db, "buildings"), { name: name.trim(), owner: user.uid, createdAt: serverTimestamp() });
  return ref.id;
}

/** Adds a floor at the end, with its plan image shrunk until it fits a record. */
export async function addFloor(buildingId: string, label: string, plan: Blob): Promise<void> {
  const { db } = await firebase();
  const floors = collection(db, "buildings", buildingId, "floors");
  const order = (await getDocs(floors)).size;
  let shrunk = await shrink(plan, 1600, 0.75);
  if (shrunk.image.length > MAX_RECORD) shrunk = await shrink(plan, 1200, 0.6);
  if (shrunk.image.length > MAX_RECORD) throw new Error("That plan image is too detailed to store. Try a smaller or simpler image.");
  await addDoc(floors, { label: label.trim(), order, ...shrunk, createdAt: serverTimestamp() });
}

export async function listMyBuildings(): Promise<Building[]> {
  const { db, user } = await firebase();
  const snap = await getDocs(query(collection(db, "buildings"), where("owner", "==", user.uid)));
  return snap.docs
    .map((d) => toBuilding(d.id, d.data()))
    .sort((a, b) => (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now()));
}

export async function getBuilding(id: string): Promise<{ building: Building; floors: Floor[]; mine: boolean } | null> {
  const { db, user } = await firebase();
  const snap = await getDoc(doc(db, "buildings", id));
  if (!snap.exists()) return null;
  const floors = await getDocs(query(collection(db, "buildings", id, "floors"), orderBy("order")));
  const building = toBuilding(snap.id, snap.data());
  return {
    building,
    mine: building.owner === user.uid,
    floors: floors.docs.map((d) => {
      const f = d.data();
      return { id: d.id, label: String(f.label), order: Number(f.order), image: String(f.image), width: Number(f.width), height: Number(f.height) };
    }),
  };
}

function toBuilding(id: string, d: Record<string, unknown>): Building {
  return { id, name: String(d.name), owner: String(d.owner), createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : null };
}

/** A plan image as a JPEG data URL no bigger than `maxSide` px, with its size. */
async function shrink(file: Blob, maxSide: number, quality: number): Promise<{ image: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent plan images get a white background
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { image: canvas.toDataURL("image/jpeg", quality), width, height };
}
