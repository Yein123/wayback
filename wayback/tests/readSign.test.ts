import { describe, expect, it } from "vitest";
import Ocr from "@gutenye/ocr-node";
import { getSpot } from "@/lib/map";
import { readSignText } from "@/lib/signText";

// The phone runs the same PaddleOCR models in a Web Worker (lib/ocr.worker.ts); this is the Node build.
// Slow (a couple of minutes), so it only runs with `npm run check:ocr`.
describe.runIf(process.env.npm_lifecycle_event === "check:ocr")("reading real sign photos", () => {
  const read = async (ocr: Awaited<ReturnType<typeof Ocr.create>>, file: string) =>
    readSignText((await ocr.detect(`tests/fixtures/signs/${file}`)).texts.map((t: { text: string }) => t.text).join("\n"));

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
  }, 400_000);
});
