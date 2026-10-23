// The dorm map: fixed spots and links, shipped with the app.
import dormMap from "@/public/data/dorm-map.json";
import { floorLevel } from "@/lib/building";

export { floorLevel };

export type Spot = {
  id: string;
  label: string;
  floor: string;
  type: string;
  signText?: string[];
  room?: string;
  /** Schematic position on its floor, roughly in metres (x east, y south); the lift lobbies sit at 0,0. */
  pos: [number, number];
  /** Height in floor levels when it isn't the floor's own (a cube half a flight up is 4.5). */
  level?: number;
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

// JSON imports type `pos` as number[], not a pair
export const map = dormMap as unknown as DormMap;
export const spots: Spot[] = map.spots;

const byId = new Map(spots.map((s) => [s.id, s]));

/** Stacking level for the 3D view; cubes sit half a flight off their hallway's floor. */
export function spotLevel(spot: Spot): number {
  return spot.level ?? floorLevel(spot.floor);
}

export function getSpot(id: string): Spot | undefined {
  return byId.get(id);
}
