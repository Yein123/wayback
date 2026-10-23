// Trip State: the route being followed right now. Mirrored to sessionStorage so a
// refresh mid-route keeps your place; it doesn't need to outlive the browser tab.
import { useSyncExternalStore } from "react";
import type { Step } from "@/lib/route";

export type Trip = {
  mode: "toRoom" | "toCar";
  from: string;
  to: string;
  steps: Step[];
  stepIndex: number;
  /** For a trip back to the car: the saved parking that Arrived ends. */
  parkingId?: string;
};

const KEY = "wayback.trip";
const listeners = new Set<() => void>();
let cached: { raw: string | null; trip: Trip | null } = { raw: null, trip: null };

function read(): Trip | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    return cached.trip;
  }
  if (raw !== cached.raw) cached = { raw, trip: raw ? (JSON.parse(raw) as Trip) : null };
  return cached.trip;
}

function write(trip: Trip | null) {
  try {
    if (trip) sessionStorage.setItem(KEY, JSON.stringify(trip));
    else sessionStorage.removeItem(KEY);
  } catch {
    cached = { raw: null, trip };
  }
  listeners.forEach((l) => l());
}

export function startTrip(trip: Omit<Trip, "stepIndex">) {
  write({ ...trip, stepIndex: 0 });
}

export function setStepIndex(stepIndex: number) {
  const trip = read();
  if (trip) write({ ...trip, stepIndex });
}

/** The trip right now, outside React (e.g. to keep its destination when Help re-routes). */
export function currentTrip(): Trip | null {
  return read();
}

export function endTrip() {
  write(null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current trip; `undefined` while rendering on the server, `null` when there is none. */
export function useTrip(): Trip | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}
