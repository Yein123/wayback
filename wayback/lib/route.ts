// Route Planner: room lookup, Dijkstra shortest path, and turning a path into steps.
// Pure functions over a DormMap (tested in tests/route.test.ts).
import { map as dormMap, type Diagram, type DormMap, type Link } from "@/lib/map";

export type Step = { text: string; diagram: Diagram };

/** "f6 26", "F626", "f6-26" → "F6-26". */
export function normalizeRoom(input: string): string {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = compact.match(/^([A-Z])(\d)(\d{1,2})$/);
  return m ? `${m[1]}${m[2]}-${m[3].padStart(2, "0")}` : compact;
}

/** The map spot for a typed room number, or null if the map doesn't know it. */
export function findRoom(roomNumber: string, map: DormMap = dormMap): string | null {
  const wanted = normalizeRoom(roomNumber);
  return map.spots.find((s) => s.room && normalizeRoom(s.room) === wanted)?.id ?? null;
}

/** Shortest list of links from one spot to another (Dijkstra on walking cost), or null if unreachable. */
export function shortestPath(fromId: string, toId: string, map: DormMap = dormMap): Link[] | null {
  if (fromId === toId) return [];
  const outgoing = new Map<string, Link[]>();
  for (const link of map.links) {
    outgoing.set(link.from, [...(outgoing.get(link.from) ?? []), link]);
  }

  const dist = new Map<string, number>([[fromId, 0]]);
  const via = new Map<string, Link>();
  const done = new Set<string>();

  while (true) {
    // The map is small, so a plain scan for the closest unvisited spot is enough.
    let current: string | null = null;
    for (const [id, d] of dist) {
      if (!done.has(id) && (current === null || d < dist.get(current)!)) current = id;
    }
    if (current === null) return null;
    if (current === toId) break;
    done.add(current);

    for (const link of outgoing.get(current) ?? []) {
      const d = dist.get(current)! + link.cost;
      if (d < (dist.get(link.to) ?? Infinity)) {
        dist.set(link.to, d);
        via.set(link.to, link);
      }
    }
  }

  const path: Link[] = [];
  for (let id = toId; id !== fromId; id = via.get(id)!.from) path.unshift(via.get(id)!);
  return path;
}

/** One step per link, plus a final "you've arrived" step. */
export function toSteps(path: Link[], arrival: { target: "car" | "room"; label: string }): Step[] {
  const steps = path.map((link) => ({ text: link.instruction, diagram: link.diagram }));
  const text = arrival.target === "car" ? `Your car is here: ${arrival.label}` : `You've arrived: ${arrival.label}`;
  return [...steps, { text, diagram: { kind: "arrive", ...arrival } }];
}
