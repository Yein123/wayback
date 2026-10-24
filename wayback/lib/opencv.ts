// OpenCV for the OCR worker, loaded from the CDN at run time: its single 10 MB file is too big for the
// bundler (and asks for Node's fs). next.config.ts points `@techstark/opencv-js` here; Node tests use the real package.
type Cv = Record<string, unknown> & { Mat?: unknown; onRuntimeInitialized?: () => void };
const scope = globalThis as unknown as { cv?: Cv };

const URL = "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.3/dist/opencv.js";
let loading: Promise<void> | null = null;

/** Download and start OpenCV once; the OCR can't find text lines before this has finished. */
export function loadOpenCv(): Promise<void> {
  loading ??= (async () => {
    const code = await (await fetch(URL)).text();
    // A global eval, so its UMD wrapper sets self.cv the way a classic worker script would.
    (0, eval)(code);
    const cv = scope.cv!;
    if (!cv.Mat) await new Promise<void>((resolve) => (cv.onRuntimeInitialized = () => resolve()));
  })();
  loading.catch(() => (loading = null));
  return loading;
}

// The OCR package does `import cv from "@techstark/opencv-js"` and uses it only after loadOpenCv().
const cv = new Proxy({} as Cv, {
  get: (_, key) => scope.cv?.[key as string],
  set: (_, key, value) => {
    scope.cv![key as string] = value;
    return true;
  },
});
export default cv;
