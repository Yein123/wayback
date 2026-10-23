import { describe, expect, it } from "vitest";
import { gpsToMap } from "@/lib/gps";

describe("gpsToMap", () => {
  // Three made-up anchors near USM, with the map turned 30° and in metres from the lobby.
  const lat0 = 5.355;
  const lng0 = 100.296;
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const turn = (30 * Math.PI) / 180;
  const toMap = (east: number, south: number): [number, number] => [
    east * Math.cos(turn) - south * Math.sin(turn) + 10,
    east * Math.sin(turn) + south * Math.cos(turn) - 4,
  ];
  const at = (east: number, south: number) => ({ lat: lat0 - south / mPerLat, lng: lng0 + east / mPerLng });
  const anchors = [
    { ...at(0, 0), pos: toMap(0, 0) },
    { ...at(40, 10), pos: toMap(40, 10) },
    { ...at(-20, 35), pos: toMap(-20, 35) },
  ];

  it("puts a GPS fix in the right place on the map", () => {
    const here = gpsToMap({ ...at(15, 20), accuracy: 6 }, anchors)!;
    const [x, y] = toMap(15, 20);
    expect(here.x).toBeCloseTo(x, 1);
    expect(here.y).toBeCloseTo(y, 1);
    expect(here.accuracy).toBeCloseTo(6, 1);
  });

  it("is off with fewer than two anchors", () => {
    expect(gpsToMap({ ...at(0, 0), accuracy: 5 }, anchors.slice(0, 1))).toBeNull();
  });
});
