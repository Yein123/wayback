import { describe, expect, it } from "vitest";
import { getSpot, map } from "@/lib/map";
import { findRoom, floorChange, normalizeRoom, shortestPath, toSteps } from "@/lib/route";

const spotsOn = (from: string, to: string) => {
  const path = shortestPath(from, to)!;
  return [from, ...path.map((l) => l.to)];
};

describe("findRoom", () => {
  it("finds the demo room however it is typed", () => {
    for (const typed of ["F6-26", "f6-26", "F626", "f6 26"]) {
      expect(findRoom(typed)).toBe("room-f6-26");
    }
  });

  it("knows every room in the block, the way the doors are numbered", () => {
    expect(findRoom("F3-12")).toBe("room-f3-12");
    expect(findRoom("f5 48")).toBe("room-f5-48");
    expect(findRoom("F10-48")).toBe("room-f10-48");
    // floors 1–4 have all four wings (64 rooms a floor); from floor 5 up the NW and SW wings are short (48)
    const on = (floor: string) => map.spots.filter((s) => s.type === "room" && s.floor === floor).length;
    expect([on("2"), on("3"), on("4"), on("5"), on("6"), on("10")]).toEqual([64, 64, 64, 48, 48, 48]);
    expect(findRoom("F5-49")).toBeNull();
  });

  it("routes from the car park to a floor 3 room by lift, hallway stair, cube and door", () => {
    const path = spotsOn("cp-se", "room-f3-12");
    expect(path).toContain("lobby-3");
    expect(path.at(-2)).toMatch(/^cube-f3-/);
    expect(getSpot(path.at(-1)!)!.room).toBe("F3-12");
  });

  it("returns null for a room the map doesn't know", () => {
    expect(findRoom("F9-99")).toBeNull();
    expect(findRoom("hello")).toBeNull();
  });

  it("normalizes room codes", () => {
    expect(normalizeRoom("f6 7")).toBe("F6-07");
  });
});

describe("dorm map", () => {
  it("has a reverse link for every link", () => {
    for (const link of map.links) {
      expect(map.links.some((l) => l.from === link.to && l.to === link.from), `${link.from} -> ${link.to}`).toBe(true);
    }
  });

  it("only links spots that exist", () => {
    const ids = new Set(map.spots.map((s) => s.id));
    for (const link of map.links) {
      expect(ids.has(link.from) && ids.has(link.to), `${link.from} -> ${link.to}`).toBe(true);
    }
  });
});

describe("shortestPath", () => {
  it("routes the SE car park through the SE entrance and the floor 1 lifts", () => {
    expect(spotsOn("cp-se", "room-f6-26")).toEqual([
      "cp-se",
      "entrance-se",
      "hall-1-se",
      "lobby-1",
      "lobby-5",
      "se-stair-1",
      "se-stair-2",
      "cube-f6-25",
      "room-f6-26",
    ]);
  });

  it("routes the SW car park through the SW entrance and the B2 lifts", () => {
    const spots = spotsOn("cp-sw", "room-f6-26");
    expect(spots.slice(0, 5)).toEqual(["cp-sw", "entrance-sw", "hall-b2-sw", "lobby-b2", "lobby-5"]);
    expect(spots).not.toContain("entrance-se");
  });

  it("goes back the same way, with the cube exit turning the other way", () => {
    const there = spotsOn("cp-se", "room-f6-26");
    expect(spotsOn("room-f6-26", "cp-se")).toEqual([...there].reverse());

    const into = shortestPath("se-stair-2", "cube-f6-25")![0];
    const outOf = shortestPath("cube-f6-25", "se-stair-2")![0];
    expect(into.diagram).toMatchObject({ kind: "half-stairs", dir: "up", side: "left" });
    expect(outOf.diagram).toMatchObject({ kind: "half-stairs", dir: "down", side: "right" });
  });

  it("is empty when you're already there and null when unreachable", () => {
    expect(shortestPath("lobby-5", "lobby-5")).toEqual([]);
    expect(shortestPath("lobby-5", "nowhere")).toBeNull();
  });
});

describe("map positions", () => {
  it("gives every spot a position and every link a real distance or a floor change", () => {
    for (const s of map.spots) expect(s.pos).toHaveLength(2);
    for (const l of map.links) {
      const a = getSpot(l.from)!;
      const b = getSpot(l.to)!;
      expect(a.pos.join() !== b.pos.join() || a.floor !== b.floor).toBe(true);
    }
  });
});

describe("toSteps", () => {
  it("makes one step per link plus an arrival step", () => {
    const path = shortestPath("cp-se", "room-f6-26")!;
    const steps = toSteps(path, { target: "room", label: "Room F6-26" }, "room-f6-26");
    expect(steps).toHaveLength(path.length + 1);
    expect(steps[3].text).toBe("Take any lift up to Floor 5");
    expect(steps[3]).toMatchObject({ from: "lobby-1", to: "lobby-5" });
    expect(steps.at(-1)).toEqual({
      text: "You've arrived: Room F6-26",
      diagram: { kind: "arrive", target: "room", label: "Room F6-26" },
      from: "room-f6-26",
      to: "room-f6-26",
    });
  });
});

describe("floorChange", () => {
  it("names the floor after a lift ride, and nothing for walking steps", () => {
    const steps = toSteps(shortestPath("cp-se", "room-f6-26")!, { target: "room", label: "Room F6-26" }, "room-f6-26");
    const changes = steps.map((s) => floorChange(s)).filter(Boolean);
    expect(changes).toEqual(["5"]);
    expect(floorChange(steps[0])).toBeNull();
  });

  it("names the floor going back down too", () => {
    const steps = toSteps(shortestPath("se-stair-2", "cp-se")!, { target: "car", label: "Car Park · SE Side" }, "cp-se");
    expect(steps.map((s) => floorChange(s)).filter(Boolean)).toEqual(["1"]);
  });
});
