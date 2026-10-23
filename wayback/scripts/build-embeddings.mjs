// Embeddings Setup Script: turns every tagged reference photo into a CLIP
// vector and writes public/data/embeddings.json. Run with `npm run embeddings`.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@huggingface/transformers";
import { CLIP_MODEL_ID, embedImage, loadClip } from "./clip.mjs";

const root = path.resolve(import.meta.dirname, "..");
env.cacheDir = path.join(root, ".cache");

const tags = JSON.parse(await readFile(path.join(root, "public/data/reference-photos.json"), "utf8"));
const clip = await loadClip();

const out = [];
for (const { file, spotId } of tags) {
  const vector = await embedImage(clip, path.join(root, "public/reference", file));
  out.push({ file, spotId, vector: vector.map((v) => +v.toFixed(5)) });
  console.log(`embedded ${file} -> ${spotId}`);
}

await writeFile(
  path.join(root, "public/data/embeddings.json"),
  JSON.stringify({ model: CLIP_MODEL_ID, photos: out }),
);
console.log(`wrote ${out.length} embeddings (${out[0]?.vector.length} numbers each)`);
