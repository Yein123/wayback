import { describe, expect, it } from "vitest";
import Ocr from "@gutenye/ocr-node";
import sharp from "sharp";
import { plateGray } from "@/lib/image";
import { getSpot } from "@/lib/map";
import { mergeReads, readSignText, type SignRead } from "@/lib/signText";

// The phone runs the same PaddleOCR models in a Web Worker (lib/ocr.worker.ts); this is the Node build.
// Slow (a few minutes), so it only runs with `npm run check:ocr`.
describe.runIf(process.env.npm_lifecycle_event === "check:ocr")("reading real sign photos", () => {
  type Reader = Awaited<ReturnType<typeof Ocr.create>>;
  const text = async (ocr: Reader, data: Buffer, width: number, height: number, plate: boolean) => {
    if (plate) plateGray(data);
    const { texts } = await ocr.detect({ data, width, height });
    return readSignText(texts.map((t: { text: string }) => t.text).join("\n"));
  };
  // The same two passes as lib/readSign.ts: as taken, then for a door plate if nothing was found.
  const read = async (ocr: Reader, file: string): Promise<SignRead> => {
    const pixels = () => sharp(`tests/fixtures/signs/${file}`).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data, info } = await pixels();
    const first = await text(ocr, data, info.width, info.height, false);
    if (first.floor || first.cube || first.room) return first;
    const again = await pixels();
    return mergeReads([first, await text(ocr, again.data, info.width, info.height, true)]);
  };

  it("tells the floor from lift signs and the cube from a cube's board", async () => {
    const ocr = await Ocr.create();
    expect(await read(ocr, "aras-1-da.jpg")).toMatchObject({ floor: "1" });
    expect(await read(ocr, "aras-1-bc.jpg")).toMatchObject({ floor: "1" });
    expect(await read(ocr, "aras-5-straight.jpg")).toMatchObject({ floor: "5" });
    expect(await read(ocr, "aras-5-tilted.jpg")).toMatchObject({ floor: "5" });
    const board = await read(ocr, "cube-f6-37.jpg");
    expect(board).toMatchObject({ cube: "F6-37", floor: "5" });
    expect(getSpot(`cube-${board.cube!.toLowerCase()}`)).toBeDefined();
    expect(await read(ocr, "cube-f6-25.jpg")).toMatchObject({ cube: "F6-25", floor: "5" });
  }, 600_000);

  it("reads white-on-yellow door plates", async () => {
    const ocr = await Ocr.create();
    for (const room of ["F6-26", "F6-27"]) {
      const door = await read(ocr, `room-${room.toLowerCase()}.jpg`);
      expect(door).toMatchObject({ room, floor: "5" });
      expect(getSpot(`room-${room.toLowerCase()}`)).toBeDefined();
    }
  }, 300_000);
});
