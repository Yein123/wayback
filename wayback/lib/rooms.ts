// Every room in the block as map spots and links, generated from the building's layout rules:
// on each lift floor, the hallway stairs, each cube off them, and the four rooms in each cube.
// Hand-mapped spots and links in dorm-map.json win where they overlap (same id, same from → to).
import { CUBE_ENTRY_X, cubePlan, cubePoint, cubes, floorLevel, HALLWAYS, LIFT_FLOORS, roomNumber, type Cube } from "@/lib/building";
import type { Diagram, Link, Spot } from "@/lib/map";

/** Lift floors with hallways and cubes; B2 is car park only. */
const ROOM_FLOORS = LIFT_FLOORS.filter((f) => !f.startsWith("B"));
const WALK = 1.3; // metres per second

// Floor 5's SE stairs were mapped by hand first, under these ids.
const stairId = (floor: string, h: string, stair: number) => (floor === "5" ? `${h}-stair-${stair}` : `f${floor}-${h}-stair-${stair}`).toLowerCase();
const lobbyId = (floor: string) => `lobby-${floor.toLowerCase()}`;
const floorName = (floor: string) => (floor.startsWith("B") ? floor : `Floor ${floor}`);
const cost = (a: [number, number], b: [number, number]) => Math.max(5, Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) / WALK));
const center = (c: Cube, room: number): [number, number] => {
  const p = cubePlan(1).find((p) => p.room === room)!;
  return round(cubePoint(c, (p.x[0] + p.x[1]) / 2, (p.d[0] + p.d[1]) / 2));
};

export function roomGraph(): { spots: Spot[]; links: Link[] } {
  const spots: Spot[] = [];
  const links: Link[] = [];
  const both = (a: Spot, b: Spot, there: [string, Diagram], back: [string, Diagram], secs = cost(a.pos, b.pos)) => {
    links.push({ from: a.id, to: b.id, cost: secs, instruction: there[0], diagram: there[1] });
    links.push({ from: b.id, to: a.id, cost: secs, instruction: back[0], diagram: back[1] });
  };

  // Lifts between every pair of lift floors.
  const lobbies = LIFT_FLOORS.map((f): Spot => ({ id: lobbyId(f), label: `${floorName(f)} · Lift Lobby`, floor: f, type: "lobby", pos: [0, 0], generated: true }));
  spots.push(...lobbies);
  lobbies.forEach((a, i) =>
    lobbies.slice(i + 1).forEach((b) => {
      const ride = (to: Spot): [string, Diagram] => [
        `Take any lift ${floorLevel(to.floor) > floorLevel(to === a ? b.floor : a.floor) ? "up" : "down"} to ${floorName(to.floor)}`,
        { kind: "lift-ride", from: (to === a ? b : a).floor, to: to.floor },
      ];
      both(a, b, ride(b), ride(a), 20 + 6 * Math.abs(floorLevel(a.floor) - floorLevel(b.floor)));
    }),
  );

  // Cubes stand in columns, one every half floor; each one's inner stairs reach the cube a floor above.
  const columns = new Map<string, Spot[]>();

  for (const floor of ROOM_FLOORS) {
    const lobby = lobbies.find((l) => l.floor === floor)!;
    const all = cubes(floor);
    for (const h of HALLWAYS) {
      // One hallway spot per stair number: stairs 1 and 3 just before their stack, 2 and 4 just past it
      // (as mapped by hand on floor 5), where one of its two cubes' stairs starts.
      const stairs = [...new Set(all.filter((c) => c.hallway === h).map((c) => c.stair))].map((stair): Spot => {
        const doors = all.filter((c) => c.hallway === h && c.stair === stair).map((c) => c.door);
        doors.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
        const pos = round(stair % 2 ? doors[0] : doors.at(-1)!);
        const up = stair === 2 || stair === 3;
        return { id: stairId(floor, h, stair), label: `${floorName(floor)} · ${h} Hallway · Stair ${stair} (${up ? "up" : "down"})`, floor, type: "hallway", pos, generated: true };
      });
      stairs.sort((a, b) => Math.hypot(...a.pos) - Math.hypot(...b.pos));
      spots.push(...stairs);
      stairs.forEach((s, i) => {
        const prev = i === 0 ? lobby : stairs[i - 1];
        const n = s.id.at(-1);
        if (i === 0) both(prev, s, [`Walk into the ${h} hallway to stair ${n}`, { kind: "walk", label: `${h} HALLWAY` }], [`Walk back along the ${h} hallway to the lift lobby`, { kind: "walk", label: "LIFT LOBBY" }]);
        else both(prev, s, [`Keep going away from the lifts to stair ${n}`, { kind: "walk", label: `STAIR ${n}` }], [`Walk toward the lifts to stair ${prev.id.at(-1)}`, { kind: "walk", label: `STAIR ${prev.id.at(-1)}` }]);
      });

      for (const c of all.filter((c) => c.hallway === h)) {
        const numbers = [1, 2, 3, 4].map((r) => roomNumber(floor, c, r));
        const sorted = [...numbers].sort();
        const roomFloor = sorted[0].slice(1, sorted[0].indexOf("-"));
        const level = floorLevel(floor) + c.half;
        const cube: Spot = {
          id: `cube-${sorted[0].toLowerCase()}`,
          label: `Cube ${sorted[0]} – ${sorted[3].slice(-2)}`,
          floor: roomFloor,
          type: "cube",
          pos: round(cubePoint(c, CUBE_ENTRY_X, 0.6)),
          level,
          generated: true,
        };
        spots.push(cube);
        const column = `${h} ${c.side} ${c.center.map(Math.round).join()}`;
        columns.set(column, [...(columns.get(column) ?? []), cube]);
        const [up, down] = c.half > 0 ? ["up", "down"] : ["down", "up"];
        const other = c.side === "left" ? "right" : "left";
        both(
          stairs.find((s) => s.id === stairId(floor, h, c.stair))!,
          cube,
          [`Take the stairs on your ${c.side} half a flight ${up}, into cube ${cube.label.slice(5)}`, { kind: "half-stairs", dir: up as "up" | "down", side: c.side }],
          [`Go half a flight ${down} to the ${h} hallway, then turn ${other} toward the lifts`, { kind: "half-stairs", dir: down as "up" | "down", side: other }],
          10,
        );
        numbers.forEach((num, i) => {
          const room: Spot = { id: `room-${num.toLowerCase()}`, label: `Room ${num}`, floor: roomFloor, type: "room", room: num, pos: center(c, i + 1), level, generated: true };
          spots.push(room);
          both(
            cube,
            room,
            [`Walk in along the cube corridor to ${num} (door ${i + 1} on the plan)`, { kind: "cube", door: i + 1, label: num }],
            [`Come out of ${num} and walk back to the cube stairs`, { kind: "walk", label: "CUBE STAIRS" }],
            8,
          );
        });
      }
    }
  }
  for (const column of columns.values()) {
    column.sort((a, b) => a.level! - b.level!);
    column.forEach((below, i) => {
      const above = column[i + 1];
      if (!above || above.level! - below.level! !== 1) return;
      both(
        below,
        above,
        [`Take the cube's inner stairs up one floor, to cube ${above.label.slice(5)}`, { kind: "stairs", dir: "up", floors: 1 }],
        [`Take the cube's inner stairs down one floor, to cube ${below.label.slice(5)}`, { kind: "stairs", dir: "down", floors: 1 }],
        // a full flight, priced so the lifts still win between floors and the stairs win within one stack
        45,
      );
    });
  }
  return { spots, links };
}

function round([x, y]: [number, number]): [number, number] {
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}
