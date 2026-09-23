// onnxruntime-web (src/lib/faceEmbedding.ts) needs its own WASM binary
// served as a static asset, separate from the .onnx model file — see the
// wasmPaths comment in faceEmbedding.ts for why this is the plain
// non-threaded ort-wasm-simd.wasm from a pinned 1.18.0 (not the newer
// pthread-only builds). Vite doesn't know to copy it out of node_modules on
// its own, and it can silently go stale after a dependency update, so this
// runs on every `npm install` instead of being a one-off manual copy.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm");
const destDir = join(root, "public/ort");
const dest = join(destDir, "ort-wasm-simd.wasm");

if (!existsSync(src)) {
	console.warn(`[copy-ort-wasm] ${src} not found — skipping (onnxruntime-web not installed?)`);
	process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("[copy-ort-wasm] copied ort-wasm-simd.wasm -> public/ort/");
