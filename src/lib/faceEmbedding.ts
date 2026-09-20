import * as ort from "onnxruntime-web";

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
// aligned (see faceAlign.ts). Output: 256-dim, already L2-normalized.
const MODEL_URL = "/models/facex_nano.onnx";
const INPUT_SIZE = 112;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function loadSession(): Promise<ort.InferenceSession> {
	if (!sessionPromise) {
		// Vite dev/prod bundling doesn't serve ORT's .wasm next to its .mjs, so fetch from CDN (same as mediapipe in liveness.ts).
		ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
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

// Computes a 256-dim face embedding from the video frame or uploaded photo, aligning
// on the caller-supplied MediaPipe landmarks (from liveness.ts) rather than
// naively resizing the whole frame — embedding models are sensitive to
// alignment, so an unaligned crop meaningfully hurts match accuracy.
export async function computeFaceEmbedding(
	source: HTMLVideoElement | HTMLImageElement,
	landmarks: NormalizedPoint[],
): Promise<number[]> {
	const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
	const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
	srcCanvas ??= document.createElement("canvas");
	alignCanvas ??= document.createElement("canvas");

	srcCanvas.width = width;
	srcCanvas.height = height;
	const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true })!;
	srcCtx.drawImage(source, 0, 0);

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
