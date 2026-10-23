// Node-side CLIP helpers shared by the setup script and the match check.
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage } from "@huggingface/transformers";

export const CLIP_MODEL_ID = "Xenova/clip-vit-base-patch32";

export async function loadClip() {
  const processor = await AutoProcessor.from_pretrained(CLIP_MODEL_ID);
  const model = await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL_ID, { dtype: "q8" });
  return { processor, model };
}

export async function embedImage({ processor, model }, imageOrPath) {
  const image = typeof imageOrPath === "string" ? await RawImage.read(imageOrPath) : imageOrPath;
  const inputs = await processor(image);
  const { image_embeds } = await model(inputs);
  return Array.from(image_embeds.data);
}
