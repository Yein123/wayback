// Parking Store: users/{uid}/parkings/{id}, at most one with status "current".
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { firebase } from "@/lib/firebase";
import type { Gps } from "@/lib/gps";

export type Parking = {
  id: string;
  spotId: string;
  label: string;
  thumb: string;
  gps: Gps | null;
  status: "current" | "history";
  createdAt: Date | null;
  endedAt: Date | null;
};

async function parkingsRef() {
  const { db, user } = await firebase();
  return { db, ref: collection(db, "users", user.uid, "parkings") };
}

/** Saves a new current parking; any earlier current one moves to history (nothing is lost). */
export async function saveParking(p: { spotId: string; label: string; thumb: string; gps: Gps | null }): Promise<string> {
  const { db, ref } = await parkingsRef();
  const old = await getDocs(query(ref, where("status", "==", "current")));
  const batch = writeBatch(db);
  old.forEach((d) => batch.update(d.ref, { status: "history", endedAt: serverTimestamp() }));
  const created = doc(ref);
  batch.set(created, { ...p, status: "current", createdAt: serverTimestamp(), endedAt: null });
  await batch.commit();
  return created.id;
}

/** Arrived at the car: the parking moves to history. */
export async function endParking(id: string): Promise<void> {
  const { db, ref } = await parkingsRef();
  const batch = writeBatch(db);
  batch.update(doc(ref, id), { status: "history", endedAt: serverTimestamp() });
  await batch.commit();
}

type State = { loading: boolean; current: Parking | null; history: Parking[]; error: string | null };

/** Live current parking and history (newest first) for Home. */
export function useParkings(): State {
  const [state, setState] = useState<State>({ loading: true, current: null, history: [], error: null });

  useEffect(() => {
    let stop = () => {};
    let gone = false;
    parkingsRef()
      .then(({ ref }) => {
        if (gone) return;
        stop = onSnapshot(
          query(ref, orderBy("createdAt", "desc")),
          (snap) => {
            const all = snap.docs.map((d) => toParking(d.id, d.data({ serverTimestamps: "estimate" })));
            setState({
              loading: false,
              current: all.find((p) => p.status === "current") ?? null,
              history: all.filter((p) => p.status === "history"),
              error: null,
            });
          },
          (err) => setState((s) => ({ ...s, loading: false, error: err.message })),
        );
      })
      .catch((err: Error) => setState((s) => ({ ...s, loading: false, error: err.message })));
    return () => {
      gone = true;
      stop();
    };
  }, []);

  return state;
}

function toParking(id: string, d: Record<string, unknown>): Parking {
  const date = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);
  return {
    id,
    spotId: String(d.spotId),
    label: String(d.label),
    thumb: String(d.thumb ?? ""),
    gps: (d.gps as Gps | null) ?? null,
    status: d.status === "current" ? "current" : "history",
    createdAt: date(d.createdAt),
    endedAt: date(d.endedAt),
  };
}
