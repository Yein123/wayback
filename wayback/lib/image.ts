// Photo helpers that run in the browser.

/** Shrink a camera photo so the long side is at most `maxSide` px (keeps EXIF rotation). */
export async function resizePhoto(file: Blob, maxSide = 448, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read photo"))), "image/jpeg", quality),
  );
}

/** A grey copy with the contrast stretched (darkest 1% to black, brightest 1% to white): signs read better by OCR. */
export async function grayPhoto(file: Blob, maxSide: number): Promise<Blob> {
  const bitmap = await createImageBitmap(await resizePhoto(file, maxSide, 0.95));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  stretchGray(image.data);
  ctx.putImageData(image, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read photo"))), "image/jpeg", 0.92),
  );
}

/** RGBA pixels to grey, in place, stretched so the 1st–99th percentile of brightness spans black to white. */
export function stretchGray(rgba: Uint8ClampedArray | Uint8Array): void {
  const n = rgba.length / 4;
  const counts = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const g = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
    rgba[i * 4] = g;
    counts[g]++;
  }
  const at = (share: number) => {
    let seen = 0;
    for (let v = 0; v < 256; v++) if ((seen += counts[v]) >= share * n) return v;
    return 255;
  };
  const [lo, hi] = [at(0.01), at(0.99)];
  const scale = hi > lo ? 255 / (hi - lo) : 1;
  for (let i = 0; i < n; i++) {
    const v = Math.min(255, Math.max(0, Math.round((rgba[i * 4] - lo) * scale)));
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v;
  }
}

/** A small JPEG data URL (~20–40 KB) to store inside a Firestore record. */
export async function makeThumb(file: Blob): Promise<string> {
  const small = await resizePhoto(file, 320, 0.6);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not make a thumbnail"));
    reader.readAsDataURL(small);
  });
}

/** Below this much detail a photo is mostly plain wall (measured on the survey photos: walls 1–3, real views 3.6+). */
export const PLAIN_WALL = 3.2;

/** How much is going on in a photo: the average brightness step between neighbouring pixels of a 64px-wide copy. */
export async function photoDetail(file: Blob): Promise<number> {
  // two steps down, so a big camera photo doesn't alias into fake detail
  const bitmap = await createImageBitmap(await resizePhoto(file, 448));
  const width = 64;
  const height = Math.max(1, Math.round((width * bitmap.height) / bitmap.width));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, width, height);
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  return detailScore(gray, width, height);
}

export function detailScore(gray: ArrayLike<number>, width: number, height: number): number {
  let sum = 0;
  let n = 0;
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const p = gray[y * width + x];
      sum += Math.abs(p - gray[y * width + x + 1]) + Math.abs(p - gray[(y + 1) * width + x]);
      n += 2;
    }
  }
  return n ? sum / n : 0;
}
