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
