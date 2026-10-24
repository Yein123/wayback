// Reading the words in a photo on the phone: free PaddleOCR in a Web Worker (ocr.worker.ts). It downloads
// once (about 16 MB of models), then works from the browser cache; a few seconds a photo, beside the photo match.
import { mergeReads, readSignText, type SignRead } from "@/lib/signText";

let worker: Worker | null = null;
let nextId = 0;
const waiting = new Map<number, (lines: string[] | null) => void>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./ocr.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<{ id: number; lines?: string[] }>) => {
    waiting.get(e.data.id)?.(e.data.lines ?? null);
    waiting.delete(e.data.id);
  };
  return worker;
}

function readLines(photo: Blob, plate: boolean): Promise<string[] | null> {
  const id = nextId++;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    getWorker().postMessage({ id, image: photo, plate });
  });
}

const found = (r: SignRead) => Boolean(r.floor || r.cube || r.room);

/**
 * The floor, cube or door a photo's words tell; nothing read (or no OCR) gives an empty read. When the photo
 * as taken says nothing, it's read again for a door plate (white on yellow, invisible to the first pass).
 */
export async function readSign(photo: Blob): Promise<SignRead> {
  try {
    const lines = await readLines(photo, false);
    const first = lines ? readSignText(lines.join("\n")) : { seen: [] };
    if (found(first) || !lines) return first;
    const plate = await readLines(photo, true);
    return plate ? mergeReads([first, readSignText(plate.join("\n"))]) : first;
  } catch {
    return { seen: [] };
  }
}
