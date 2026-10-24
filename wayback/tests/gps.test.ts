import { describe, expect, it } from "vitest";
import { compassName, latLngName } from "@/lib/compass";
import { gpsToMap, mapBearing } from "@/lib/gps";

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

  it("widens the accuracy by how far the fit misses rough anchors", () => {
    // each anchor's reading is 12 m off, in a different direction
    const rough = [
      { ...at(12, 0), pos: toMap(0, 0) },
      { ...at(40, 22), pos: toMap(40, 10) },
      { ...at(-32, 35), pos: toMap(-20, 35) },
      { ...at(30, 48), pos: toMap(30, 60) },
    ];
    const here = gpsToMap({ ...at(15, 20), accuracy: 6 }, rough)!;
    expect(here.accuracy).toBeGreaterThan(12);
  });

  it("turns a direction on the turned map into a real compass bearing", () => {
    const dir = (east: number, south: number): [number, number] => {
      const [a, b] = [toMap(east, south), toMap(0, 0)];
      return [a[0] - b[0], a[1] - b[1]];
    };
    expect(mapBearing(dir(0, -10), anchors)).toBeCloseTo(0, 0); // north
    expect(mapBearing(dir(10, 0), anchors)).toBeCloseTo(90, 0); // east
    expect(mapBearing(dir(-10, 10), anchors)).toBeCloseTo(225, 0); // south-west
    expect(mapBearing(dir(10, 0), anchors.slice(0, 1))).toBeNull();
  });

  it("is off with fewer than two anchors", () => {
    expect(gpsToMap({ ...at(0, 0), accuracy: 5 }, anchors.slice(0, 1))).toBeNull();
  });
});

describe("compass and coordinate names", () => {
  it("names headings by the nearest compass point", () => {
    expect(compassName(0)).toBe("N 0°");
    expect(compassName(47)).toBe("NE 47°");
    expect(compassName(181)).toBe("S 181°");
    expect(compassName(350)).toBe("N 350°");
  });

  it("writes coordinates with N/S and E/W", () => {
    expect(latLngName(5.3551234, 100.2963412)).toBe("5.35512° N, 100.29634° E");
    expect(latLngName(-33.86, -70.5)).toBe("33.86000° S, 70.50000° W");
  });
});

describe("turning to face the way", () => {
  it("says which way to turn, the short way round", async () => {
    const { turnBy, turnHint } = await import("@/lib/compass");
    expect(turnBy(10, 350)).toBe(20);
    expect(turnBy(350, 10)).toBe(-20);
    expect(turnBy(0, 180)).toBe(180);
    expect(turnHint(turnBy(10, 350))).toBe("RIGHT WAY");
    expect(turnHint(-21)).toBe("TURN LEFT 20°");
    expect(turnHint(62)).toBe("TURN RIGHT 60°");
    expect(turnHint(170)).toBe("TURN AROUND");
  });
});
