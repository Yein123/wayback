// Location Matcher: CLIP embedding of a photo, compared against the reference photos.
import { rankSpots, type ReferenceEmbedding, type SpotGuess } from "@/lib/scoring";
import { resizePhoto } from "@/lib/image";

export type ModelStatus =
  | { state: "idle" }
  | { state: "loading"; percent: number | null }
  | { state: "ready" }
  | { state: "error"; message: string };

type Listener = (status: ModelStatus) => void;

let worker: Worker | null = null;
let status: ModelStatus = { state: "idle" };
const listeners = new Set<Listener>();
const pending = new Map<number, { resolve: (v: number[]) => void; reject: (e: Error) => void }>();
let nextId = 1;
let references: Promise<ReferenceEmbedding[]> | null = null;

function setStatus(next: ModelStatus) {
  status = next;
  listeners.forEach((l) => l(status));
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./clip.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event) => {
    const msg = event.data;
    if (msg.type === "progress") {
      setStatus({ state: "loading", percent: Math.round((msg.loaded / msg.total) * 100) });
    } else if (msg.type === "ready") {
      setStatus({ state: "ready" });
    } else if (msg.type === "embedding") {
      pending.get(msg.id)?.resolve(msg.vector);
      pending.delete(msg.id);
    } else if (msg.type === "error") {
      setStatus({ state: "error", message: msg.message });
      const waiting = msg.id !== undefined ? [pending.get(msg.id)] : [...pending.values()];
      waiting.forEach((p) => p?.reject(new Error(msg.message)));
      if (msg.id !== undefined) pending.delete(msg.id);
      else pending.clear();
    }
  };
  return worker;
}

/** Start downloading the model in the background (safe to call many times). */
export function warmUp() {
  if (status.state === "idle" || status.state === "error") {
    setStatus({ state: "loading", percent: null });
    getWorker().postMessage({ type: "load" });
  }
  loadReferences();
}

export function onModelStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

function loadReferences() {
  references ??= fetch("/data/embeddings.json")
    .then((r) => r.json())
    .then((d: { photos: ReferenceEmbedding[] }) => d.photos);
  return references;
}

function embed(photo: Blob): Promise<number[]> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type: "embed", id, image: photo });
  });
}

/** Rank every map spot by how well the photo matches its reference photos. */
export async function matchPhoto(photo: Blob): Promise<SpotGuess[]> {
  warmUp();
  const [vector, refs] = await Promise.all([resizePhoto(photo).then(embed), loadReferences()]);
  return rankSpots(vector, refs);
}
