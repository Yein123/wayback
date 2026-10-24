// Reading where you are from the words in a photo: floor signs ("ARAS 5 & 6 / LEVEL 5 & 6"), a cube's
// board ("F6-25 - F6-28"), hallway signs ("F6-25 - F6-40") and door numbers ("F5-03").
// Pure text rules, tolerant of OCR slips ("RAS5&6", "LEVELS5&6", "F625"); the OCR itself is in readSign.ts.
import { LIFT_FLOORS } from "@/lib/building";

export type SignRead = {
  /** The lift floor you're on: its lobby, hallways and the cubes half a floor up and down. */
  floor?: string;
  /** A board naming one cube's four rooms: its first room ("F6-25" for F6-25 – F6-28). */
  cube?: string;
  /** A single door number, when that's all the photo shows. */
  room?: string;
  /** What was read, for showing back ("ARAS 5", "F6-25 – F6-28"). */
  seen: string[];
};

// OCR mixes up look-alike characters inside numbers.
const DIGITS: Record<string, string> = { O: "0", o: "0", D: "0", Q: "0", I: "1", l: "1", "|": "1", i: "1", S: "5", s: "5", B: "8", Z: "2", z: "2" };
const digits = (s: string) => s.replace(/[OoDQIl|iSsBZz]/g, (c) => DIGITS[c]);
const D = "[0-9OoDQIl|iSsBZz]";
// F6-25, F 6 - 25, F625 (the dash is often lost)
const ROOM = `F\\s?(${D})\\s?[-–—~=]?\\s?(${D}{2})(?![0-9])`;

/** Each room floor's lift floor: lobby F reaches rooms on F and F + 1 (the cubes half a floor up). */
export function liftFloorFor(roomFloor: number): string | undefined {
  const lift = roomFloor % 2 ? roomFloor : roomFloor - 1;
  return LIFT_FLOORS.includes(String(lift)) ? String(lift) : undefined;
}

const roomName = (m: RegExpMatchArray, i: number) => `F${Number(digits(m[i]))}-${digits(m[i + 1])}`;
// A real room number: mostly real digits (so "FIBS" isn't F1-85), floor 1–10, room 1–64.
const isRoom = (m: RegExpMatchArray, i: number) => {
  const r = roomName(m, i);
  return (m[i] + m[i + 1]).replace(/\D/g, "").length >= 2 && floorOf(r) >= 1 && floorOf(r) <= 10 && numOf(r) >= 1 && numOf(r) <= 64;
};
const floorOf = (room: string) => Number(room.slice(1, room.indexOf("-")));
const numOf = (room: string) => Number(room.slice(room.indexOf("-") + 1));

export function readSignText(text: string): SignRead {
  const seen: string[] = [];
  const flat = text.replace(/\s+/g, " ");

  const rooms = [...new Set([...flat.matchAll(new RegExp(`\\b${ROOM}`, "gi"))].filter((m) => isRoom(m, 1)).map((m) => roomName(m, 1)))];

  // Ranges: "F6-25 - F6-28". Four rooms on one floor is one cube's board.
  let cube: string | undefined;
  for (const m of flat.matchAll(new RegExp(`\\b${ROOM}\\s?[-–—~]\\s?${ROOM}`, "gi"))) {
    if (!isRoom(m, 1) || !isRoom(m, 3)) continue;
    const [a, b] = [roomName(m, 1), roomName(m, 3)];
    seen.push(`${a} – ${b}`);
    if (floorOf(a) === floorOf(b) && numOf(b) - numOf(a) === 3) cube ??= a;
  }

  // Floor signs: ARAS 5 & 6, LEVEL 5, TINGKAT 3, FLOOR 7, ARAS B2 (OCR drops the A or reads a stray S).
  let floor: string | undefined;
  const level = flat.match(new RegExp(`(?:A?RAS|LEVEL|TINGKAT|FLOOR|LANTAI)S?\\s*[:.]?\\s*(B\\s?\\d|${D}{1,2})`, "i"));
  if (level) {
    const first = level[1].replace(/\s/g, "").toUpperCase();
    // "5&" / "54&" style slips: the first digit is the floor.
    const n = /^B\d$/.test(first) ? first : String(Number(digits(first)[0]));
    floor = n.startsWith("B") ? (LIFT_FLOORS.includes(n) ? n : undefined) : liftFloorFor(Number(n));
    if (floor) seen.unshift(`ARAS ${n}`);
  }
  // Room numbers on a sign also tell the floor.
  if (!floor && rooms.length) floor = liftFloorFor(Math.min(...rooms.map(floorOf)));

  // One number and nothing else: a door.
  const room = rooms.length === 1 && !level && !cube ? rooms[0] : undefined;
  if (room) seen.push(room);
  return { floor, cube, room, seen };
}

/** What several photos' words say together: the first floor, cube and door number any of them read. */
export function mergeReads(reads: SignRead[]): SignRead {
  return {
    floor: reads.find((r) => r.floor)?.floor,
    cube: reads.find((r) => r.cube)?.cube,
    room: reads.find((r) => r.room)?.room,
    seen: [...new Set(reads.flatMap((r) => r.seen))],
  };
}
