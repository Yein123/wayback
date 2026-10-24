import { describe, expect, it } from "vitest";
import { groupSurvey, type SavedShot } from "@/lib/survey";

const shot = (over: Partial<SavedShot>): SavedShot => ({
  id: "x",
  spotId: "cp-se",
  floor: "1",
  pos: [62, 52],
  level: 0,
  cube: null,
  side: "FRONT",
  heading: null,
  gps: null,
  note: "",
  photo: null,
  createdAt: "2026-10-24T05:00:00.000Z",
  ...over,
});

describe("groupSurvey", () => {
  it("groups the sides of one spot and keeps its most accurate GPS reading", () => {
    const places = groupSurvey([
      shot({ side: "FRONT", gps: { lat: 5.1, lng: 100.1, accuracy: 21 } }),
      shot({ side: "BACK", gps: { lat: 5.2, lng: 100.2, accuracy: 11 } }),
      shot({ side: "LEFT", gps: null }),
    ]);
    expect(places).toHaveLength(1);
    expect(places[0].shots.map((s) => s.side)).toEqual(["FRONT", "BACK", "LEFT"]);
    expect(places[0].gps?.accuracy).toBe(11);
  });

  it("keeps new places apart by their pin, puts the newest first, and drops setup test records", () => {
    const places = groupSurvey([
      shot({ spotId: null, pos: [13.1, -0.4], createdAt: "2026-10-24T05:07:00.000Z" }),
      shot({ spotId: null, pos: [10.3, 1.6], createdAt: "2026-10-24T05:09:00.000Z" }),
      shot({ spotId: null, pos: [10.5, 25], note: "TEST note from setup - please ignore" }),
    ]);
    expect(places.map((p) => p.pos)).toEqual([
      [10.3, 1.6],
      [13.1, -0.4],
    ]);
    expect(places[0].gps).toBeNull();
  });
});
