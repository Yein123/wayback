// Web Worker that runs CLIP off the main thread so the screen stays smooth.
import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
  type PreTrainedModel,
  type Processor,
} from "@huggingface/transformers";

const MODEL_ID = "Xenova/clip-vit-base-patch32";

type Request = { type: "load" } | { type: "embed"; id: number; image: Blob };

let ready: Promise<{ processor: Processor; model: PreTrainedModel }> | null = null;

function load() {
  ready ??= (async () => {
    const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status === "progress" && p.file?.endsWith(".onnx") && p.total) {
        self.postMessage({ type: "progress", loaded: p.loaded, total: p.total });
      }
    };
    const processor = await AutoProcessor.from_pretrained(MODEL_ID, { progress_callback });
    // q8 on WASM: the same quantized model the embeddings script uses, so the numbers line up.
    const model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
      dtype: "q8",
      device: "wasm",
      progress_callback,
    });
    self.postMessage({ type: "ready" });
    return { processor, model };
  })();
  return ready;
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const msg = event.data;
  try {
    if (msg.type === "load") {
      await load();
    } else {
      const { processor, model } = await load();
      const image = await RawImage.fromBlob(msg.image);
      const { image_embeds } = await model(await processor(image));
      self.postMessage({ type: "embedding", id: msg.id, vector: Array.from(image_embeds.data as Float32Array) });
    }
  } catch (err) {
    ready = null;
    self.postMessage({ type: "error", id: "id" in msg ? msg.id : undefined, message: String(err) });
  }
};
