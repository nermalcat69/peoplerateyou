// The default "onnxruntime-web" entry bundles WebGPU/WebNN support and picks
// the JSEP backend variant, which needs extra files (a .jsep.wasm binary
// plus a dynamically-imported .jsep.mjs loader). We only ever use the plain
// CPU "wasm" execution provider, so import the wasm-only build instead —
// see the wasmPaths comment below for why its runtime files are fetched
// from a CDN rather than self-hosted.
import * as ort from "onnxruntime-web/wasm";

import { alignFace } from "./faceAlign";
import { extractFivePoints, type NormalizedPoint } from "./liveness";

// facex_nano.onnx — a MobileFaceNet-family face embedding model from FaceX
// (github.com/facex-engine/facex, Apache 2.0, release "facex-nano-1.0").
// Deliberately NOT FaceX's larger "xs"/"tiny"/"standard" variants: the
// maintainer's own release notes describe those as license-restricted
// ("those are the licensed ones, ping ... if you need them"), while nano
// ships with no such caveat. That's a real accuracy tradeoff (95.62% LFW
// vs. 99.07% for xs) for a model we can confidently ship in a commercial
// product. Download from:
// https://github.com/facex-engine/facex/releases/download/facex-nano-1.0/facex_nano.onnx
// and place at public/models/facex_nano.onnx (not committed here — this
// sandbox's network couldn't reach the release-asset host to fetch it).
//
// Input: 112x112 RGB float32, [-1, 1] normalized, CHW, 5-point ArcFace
// aligned (see faceAlign.ts). Output: 256-dim (verified directly against the
// model's own output metadata — the FaceX README's "512-dim" claim
// apparently describes their larger xs/tiny/standard variants, not nano).
const MODEL_URL = "/models/facex_nano.onnx";
const INPUT_SIZE = 112;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function loadSession(): Promise<ort.InferenceSession> {
	if (!sessionPromise) {
		// onnxruntime-web needs its own WASM runtime (a .wasm binary plus a
		// .mjs glue module it `import()`s at runtime), separate from the model
		// file. Self-hosting these under public/ doesn't work: Vite's dev
		// server explicitly refuses to resolve an `import()` against a path
		// under public/ (files there are meant to be fetched as plain static
		// assets, not pulled into the module graph). Pointing wasmPaths at an
		// external URL sidesteps that restriction entirely — pinned to the
		// exact installed onnxruntime-web version (see package.json) so it
		// can't silently drift out of sync on a dependency bump.
		// onnxruntime-web is pinned to an exact 1.18.0 (see package.json — not
		// a "^" range) rather than the current latest. Versions from ~1.19
		// onward dropped the plain, non-threaded ort-wasm-simd.wasm build and
		// ship only pthread/SharedArrayBuffer-requiring binaries, which fail
		// to execute correctly (opaque "Cannot read properties of undefined
		// (reading 'run')" deep in their code) unless the page sends
		// Cross-Origin-Opener-Policy/Cross-Origin-Embedder-Policy headers —
		// this app doesn't, and adding those app-wide has its own blast radius
		// (breaks any cross-origin resource, e.g. OAuth avatar images, that
		// doesn't send CORP/CORS headers). numThreads: 1 makes 1.18.0 select
		// the plain non-threaded binary, sidestepping the issue entirely.
		//
		// Self-hosted at public/ort/ (copied from
		// node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm) rather than a
		// CDN. Unlike 1.30's threaded build, 1.18.0's plain wasm loader has no
		// separate dynamically-`import()`-ed .mjs companion file per variant —
		// the Emscripten glue lives inside the already-statically-imported
		// main bundle — so this doesn't hit Vite's dev-server restriction on
		// resolving an import() against a path under public/.
		ort.env.wasm.wasmPaths = "/ort/";
		ort.env.wasm.numThreads = 1;
		sessionPromise = ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
	}
	return sessionPromise;
}

function imageDataToTensor(imageData: ImageData): ort.Tensor {
	const { data } = imageData;
	const plane = INPUT_SIZE * INPUT_SIZE;
	const floatData = new Float32Array(3 * plane);
	for (let i = 0; i < plane; i++) {
		floatData[i] = data[i * 4] / 127.5 - 1;
		floatData[plane + i] = data[i * 4 + 1] / 127.5 - 1;
		floatData[2 * plane + i] = data[i * 4 + 2] / 127.5 - 1;
	}
	return new ort.Tensor("float32", floatData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

let srcCanvas: HTMLCanvasElement | null = null;
let alignCanvas: HTMLCanvasElement | null = null;

export type EmbeddableSource = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

function sourceDimensions(source: EmbeddableSource): { width: number; height: number } {
	if (source instanceof HTMLVideoElement) return { width: source.videoWidth, height: source.videoHeight };
	if (source instanceof HTMLImageElement) return { width: source.naturalWidth, height: source.naturalHeight };
	return { width: source.width, height: source.height };
}

// Computes a face embedding from a frame/image, aligning on the
// caller-supplied MediaPipe landmarks (from liveness.ts) rather than
// naively resizing the whole frame — embedding models are sensitive to
// alignment, so an unaligned crop meaningfully hurts match accuracy. Works
// on a live video frame or a static uploaded photo alike.
export async function computeFaceEmbedding(
	source: EmbeddableSource,
	landmarks: NormalizedPoint[],
): Promise<number[]> {
	srcCanvas ??= document.createElement("canvas");
	alignCanvas ??= document.createElement("canvas");

	const { width, height } = sourceDimensions(source);
	srcCanvas.width = width;
	srcCanvas.height = height;
	const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true })!;
	srcCtx.drawImage(source, 0, 0, width, height);

	const kps = extractFivePoints(landmarks, width, height);
	alignCanvas.width = 112;
	alignCanvas.height = 112;
	const alignCtx = alignCanvas.getContext("2d", { willReadFrequently: true })!;
	const aligned = alignFace(
		srcCtx,
		width,
		height,
		[kps.leftEye, kps.rightEye, kps.nose, kps.mouthLeft, kps.mouthRight],
		alignCtx,
	);

	const session = await loadSession();
	const tensor = imageDataToTensor(aligned);
	const inputName = session.inputNames[0];
	const outputs = await session.run({ [inputName]: tensor });
	const output = outputs[session.outputNames[0]];
	return Array.from(output.data as Float32Array);
}
