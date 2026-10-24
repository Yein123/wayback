import { describe, expect, it } from "vitest";
import { roomGraph } from "@/lib/rooms";
import { findRoom } from "@/lib/route";
import { renameRooms } from "@/lib/roomNumbers";
import type { DormMap } from "@/lib/map";

describe("renameRooms", () => {
  const fresh = (): DormMap => structuredClone(roomGraph());

  it("puts the surveyed number on the room, its label and the step into it", () => {
    const m = fresh();
    renameRooms(m, { "room-f7-20": "F7-21" });
    const spot = m.spots.find((s) => s.id === "room-f7-20")!;
    expect([spot.room, spot.label]).toEqual(["F7-21", "Room F7-21"]);
    const into = m.links.find((l) => l.to === "room-f7-20")!;
    expect(into.instruction).toContain("F7-21");
    expect(into.diagram).toMatchObject({ kind: "cube", label: "F7-21" });
  });

  it("finds the surveyed room first when two rooms now share a number", () => {
    const m = fresh();
    renameRooms(m, { "room-f7-20": "F7-21" });
    expect(findRoom("F7-21", m)).toBe("room-f7-20");
  });

  it("ignores numbers that don't look like room numbers", () => {
    const m = fresh();
    renameRooms(m, { "room-f7-20": "hello" });
    expect(m.spots.find((s) => s.id === "room-f7-20")!.room).toBe("F7-20");
  });
});
