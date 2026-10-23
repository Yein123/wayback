// The dorm map: fixed spots and links, shipped with the app.
import dormMap from "@/public/data/dorm-map.json";

export type Spot = {
  id: string;
  label: string;
  floor: string;
  type: string;
  signText?: string[];
  room?: string;
};

/** Which picture a direction step shows (drawn by components/StepDiagram.tsx). */
export type Diagram =
  | { kind: "lifts"; count: number; highlight: number }
  | { kind: "turn"; dir: "left" | "right" | "straight"; sign?: string }
  | { kind: "lift-ride"; from: string; to: string }
  | { kind: "door"; label?: string }
  | { kind: "walk"; label?: string }
  | { kind: "stairs"; dir: "up" | "down"; floors: number }
  | { kind: "half-stairs"; dir: "up" | "down"; side: "left" | "right" }
  | { kind: "cube"; door: number; label: string }
  | { kind: "arrive"; target: "car" | "room"; label: string };

/** One-way link; every link has a matching reverse link with its own instruction. */
export type Link = {
  from: string;
  to: string;
  /** Rough walking seconds. */
  cost: number;
  instruction: string;
  diagram: Diagram;
};

export type DormMap = { spots: Spot[]; links: Link[] };

export const map = dormMap as DormMap;
export const spots: Spot[] = map.spots;

const byId = new Map(spots.map((s) => [s.id, s]));

export function getSpot(id: string): Spot | undefined {
  return byId.get(id);
}
