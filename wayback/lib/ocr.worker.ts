// Web Worker that reads the words in a photo (PaddleOCR: finds each line of text, then reads it), off the
// main thread so the screen stays smooth. Built for photos of real signs: small, tilted and on busy walls.
import Ocr, { ImageRawBase, registerBackend, type ImageRawData, type SizeOption } from "@gutenye/ocr-common";
import { splitIntoLineImages } from "@gutenye/ocr-common/splitIntoLineImages";
import { loadOpenCv } from "@/lib/opencv";
import * as ort from "onnxruntime-web";

// The same runtime build transformers.js loads for the photo match, so the browser caches it once.
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
const MODELS = "https://cdn.jsdelivr.net/npm/@gutenye/ocr-models@1.4.2/assets";
// Bigger photos are shrunk to this long side: enough for a small board across a corridor.
const MAX_SIDE = 2560;

/** Pixels the OCR can resize, on an OffscreenCanvas (the package's own version needs the page's canvas). */
class WorkerImage extends ImageRawBase {
  async resize({ width, height }: SizeOption) {
    const w = width ?? Math.round((this.width / this.height) * height!);
    const h = height ?? Math.round((this.height / this.width) * width!);
    return new WorkerImage(drawn(this, w, h));
  }
}

function drawn(image: ImageRawData, width: number, height: number): ImageRawData {
  const source = new OffscreenCanvas(image.width, image.height);
  source.getContext("2d")!.putImageData(new ImageData(Uint8ClampedArray.from(image.data), image.width, image.height), 0, 0);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

registerBackend({
  FileUtils: { read: async (url: string) => (await fetch(url)).text() },
  ImageRaw: WorkerImage,
  InferenceSession: ort.InferenceSession,
  splitIntoLineImages,
  defaultModels: undefined,
});

let ready: Promise<Ocr> | null = null;

function load() {
  ready ??= (async () => {
    await loadOpenCv();
    return Ocr.create({
      models: {
        detectionPath: `${MODELS}/ch_PP-OCRv4_det_infer.onnx`,
        recognitionPath: `${MODELS}/ch_PP-OCRv4_rec_infer.onnx`,
        dictionaryPath: `${MODELS}/ppocr_keys_v1.txt`,
      },
    });
  })();
  // a failed download can be tried again with the next photo
  ready.catch(() => (ready = null));
  return ready;
}

type Request = { id: number; image: Blob };

self.onmessage = async (event: MessageEvent<Request>) => {
  const { id, image } = event.data;
  try {
    const ocr = await load();
    const bitmap = await createImageBitmap(image, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const [width, height] = [Math.round(bitmap.width * scale), Math.round(bitmap.height * scale)];
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const { texts } = await ocr.detect(ctx.getImageData(0, 0, width, height));
    self.postMessage({ id, lines: texts.map((t) => t.text) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
