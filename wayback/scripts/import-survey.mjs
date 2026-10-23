// Survey import: turns a survey pack (downloaded from the Survey screen) into reference photos,
// photo tags, GPS anchors, and a list of new places to add to the map. Then rebuild the embeddings.
// Usage: npm run import-survey -- path/to/wayback-survey-YYYY-MM-DD.json
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const packPath = process.argv[2];
if (!packPath) {
  console.error("Usage: npm run import-survey -- path/to/wayback-survey.json");
  process.exit(1);
}

const pack = JSON.parse(await readFile(packPath, "utf8"));
const tagsPath = path.join(root, "public/data/reference-photos.json");
const anchorsPath = path.join(root, "public/data/gps-anchors.json");
const tags = JSON.parse(await readFile(tagsPath, "utf8"));
const known = new Set(tags.map((t) => t.file));

let added = 0;
const newPlaces = [];
const fixes = new Map(); // spotId → GPS readings good enough to anchor with

for (const shot of pack.shots) {
  if (!shot.spotId) {
    newPlaces.push({ floor: shot.floor, pos: shot.pos, side: shot.side, gps: shot.gps, id: shot.id });
    continue;
  }
  const file = `survey-${shot.spotId}-${shot.side.toLowerCase()}-${shot.id.slice(0, 6)}.jpg`;
  if (!known.has(file)) {
    const jpeg = Buffer.from(shot.photo.split(",")[1], "base64");
    await writeFile(path.join(root, "public/reference", file), jpeg);
    tags.push({ file, spotId: shot.spotId });
    known.add(file);
    added++;
  }
  if (shot.gps && shot.gps.accuracy <= 20) {
    const list = fixes.get(shot.spotId) ?? { pos: shot.pos, readings: [] };
    list.readings.push(shot.gps);
    fixes.set(shot.spotId, list);
  }
}

// One anchor per spot: the accuracy-weighted average of its good readings.
const anchors = [...fixes.entries()].map(([spotId, { pos, readings }]) => {
  const w = readings.map((r) => 1 / (r.accuracy * r.accuracy));
  const sum = w.reduce((a, b) => a + b, 0);
  const avg = (k) => readings.reduce((a, r, i) => a + r[k] * w[i], 0) / sum;
  return { spotId, lat: avg("lat"), lng: avg("lng"), pos, readings: readings.length };
});

await writeFile(tagsPath, JSON.stringify(tags, null, 2) + "\n");
if (anchors.length) await writeFile(anchorsPath, JSON.stringify(anchors, null, 2) + "\n");
if (newPlaces.length) await writeFile(path.join(root, "survey-new-places.json"), JSON.stringify(newPlaces, null, 2) + "\n");

console.log(`added ${added} reference photos (${tags.length} total)`);
console.log(anchors.length ? `wrote ${anchors.length} GPS anchors${anchors.length < 2 ? " (need 2+ for the GPS pin)" : ""}` : "no GPS readings within 20 m, anchors unchanged");
if (newPlaces.length) console.log(`${newPlaces.length} photos of new places listed in survey-new-places.json (add them to the map)`);
console.log("next: npm run embeddings");
