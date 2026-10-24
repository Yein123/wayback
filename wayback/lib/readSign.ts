// Reading the words in a photo on the phone (Tesseract OCR, free and in the browser; it downloads once,
// about 3 MB, then works from cache). Slow-ish (a few seconds a photo), so it runs beside the photo match.
import { resizePhoto } from "@/lib/image";
import { readSignText, type SignRead } from "@/lib/signText";

type Ocr = { recognize: (image: Blob) => Promise<{ data: { text: string } }> };
let worker: Promise<Ocr> | null = null;

function ocr(): Promise<Ocr> {
  worker ??= import("tesseract.js").then(async ({ createWorker, PSM }) => {
    const w = await createWorker("eng");
    // Sparse text: signs and door numbers scattered on a wall, not a page of text.
    await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    return w;
  });
  // a failed download can be tried again next photo
  worker.catch(() => (worker = null));
  return worker;
}

/** The floor, cube or door a photo's words tell; nothing read (or no OCR) gives an empty read. */
export async function readSign(photo: Blob): Promise<SignRead> {
  try {
    // Big enough for a sign across a lobby, small enough to read in a few seconds.
    const image = await resizePhoto(photo, 2400, 0.92);
    const { data } = await (await ocr()).recognize(image);
    return readSignText(data.text);
  } catch {
    return { seen: [] };
  }
}
