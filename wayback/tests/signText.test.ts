import { describe, expect, it } from "vitest";
import { liftFloorFor, readSignText } from "@/lib/signText";

describe("readSignText", () => {
  it("reads the lobby floor sign, OCR slips and all", () => {
    // real OCR output from lobby-5-nw-sign.jpg
    const read = readSignText("S58 | Te | RAS5&6 | '® x | LEVELS54&6 | F6-01 - F6-08 | F5-01 - F5-08 | F6-41 - F6-48 | F5-41 - F5-48");
    expect(read.floor).toBe("5");
    expect(read.room).toBeUndefined();
    expect(read.cube).toBeUndefined();
    expect(read.seen).toContain("F6-01 – F6-08");
  });

  it("gets the floor from room ranges alone", () => {
    // real OCR output from lobby-5-se-sign.jpg (no ARAS line read)
    expect(readSignText("J\nF625 ° F6-40 =p\nF525 - F5-40\n- F6-09 ° F6-24 1\nF5-09 - F5-24").floor).toBe("5");
  });

  it("knows a cube's board by its four rooms", () => {
    const read = readSignText("F6-25 - F6-28");
    expect(read.cube).toBe("F6-25");
    expect(read.floor).toBe("5");
    expect(read.room).toBeUndefined();
  });

  it("reads a door number", () => {
    expect(readSignText("  F7-2O \n")).toMatchObject({ room: "F7-20", floor: "7" });
    expect(readSignText("F 3 - 12")).toMatchObject({ room: "F3-12", floor: "3" });
  });

  it("ignores words that only look like room numbers", () => {
    expect(readSignText("FIBS FOOD INFO LAIN Servis")).toEqual({ seen: [] });
  });

  it("maps room floors to the lift floor that reaches them", () => {
    expect(liftFloorFor(6)).toBe("5");
    expect(liftFloorFor(7)).toBe("7");
    expect(liftFloorFor(2)).toBe("1");
    expect(liftFloorFor(12)).toBeUndefined();
  });
});
