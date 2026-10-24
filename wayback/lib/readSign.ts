// Reading the words in a photo on the phone: free PaddleOCR in a Web Worker (ocr.worker.ts). It downloads
// once (about 16 MB of models), then works from the browser cache; a few seconds a photo, beside the photo match.
import { readSignText, type SignRead } from "@/lib/signText";

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

/** The floor, cube or door a photo's words tell; nothing read (or no OCR) gives an empty read. */
export async function readSign(photo: Blob): Promise<SignRead> {
  try {
    const id = nextId++;
    const lines = await new Promise<string[] | null>((resolve) => {
      waiting.set(id, resolve);
      getWorker().postMessage({ id, image: photo });
    });
    return lines ? readSignText(lines.join("\n")) : { seen: [] };
  } catch {
    return { seen: [] };
  }
}
