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

export const spots: Spot[] = dormMap.spots;

const byId = new Map(spots.map((s) => [s.id, s]));

export function getSpot(id: string): Spot | undefined {
  return byId.get(id);
}
