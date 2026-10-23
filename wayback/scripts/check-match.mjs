// Sanity check for the matcher: a cropped, darkened, slightly tilted copy of
// each reference photo should still have its own spot as the top guess.
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env, RawImage } from "@huggingface/transformers";
import { embedImage, loadClip } from "./clip.mjs";

const root = path.resolve(import.meta.dirname, "..");
env.cacheDir = path.join(root, ".cache");

const { photos } = JSON.parse(await readFile(path.join(root, "public/data/embeddings.json"), "utf8"));
const clip = await loadClip();

const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return dot / Math.sqrt(na * nb);
};

let failures = 0;
for (const { file, spotId } of photos) {
  const src = sharp(path.join(root, "public/reference", file));
  const { width, height } = await src.metadata();
  const buf = await src
    .extract({ left: Math.round(width * 0.1), top: Math.round(height * 0.12), width: Math.round(width * 0.8), height: Math.round(height * 0.75) })
    .rotate(4, { background: "#000" })
    .modulate({ brightness: 0.7 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const image = new RawImage(new Uint8ClampedArray(buf.data), buf.info.width, buf.info.height, buf.info.channels);
  const query = await embedImage(clip, image);

  const best = new Map();
  for (const p of photos) {
    const s = cosine(query, p.vector);
    if (!best.has(p.spotId) || s > best.get(p.spotId)) best.set(p.spotId, s);
  }
  const ranked = [...best.entries()].sort((a, b) => b[1] - a[1]);
  const ok = ranked[0][0] === spotId;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${file}: top ${ranked[0][0]} (${ranked[0][1].toFixed(3)}), 2nd ${ranked[1][0]} (${ranked[1][1].toFixed(3)})`);
}
console.log(failures ? `${failures} photo(s) matched the wrong spot` : "all altered photos matched their own spot");
process.exit(failures ? 1 : 0);
