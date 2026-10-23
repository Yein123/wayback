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
