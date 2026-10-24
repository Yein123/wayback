// js-clipper (used by the sign reader's OCR) has Latin-1 ¹ ² in its comments, and the bundler only reads
// UTF-8. Runs after npm install: re-saves the file as UTF-8 (only comments change).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const file = new URL("../node_modules/js-clipper/clipper.js", import.meta.url);
if (existsSync(file)) {
  const bytes = readFileSync(file);
  if (bytes.some((b) => b > 127) && !isUtf8(bytes)) writeFileSync(file, bytes.toString("latin1"), "utf8");
}

function isUtf8(bytes) {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}
