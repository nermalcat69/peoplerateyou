import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// Loaded lazily and only from the verification route, since the WASM runtime
// and model are several MB and most users never touch this page.
const landmarkerPromises: Partial<Record<"VIDEO" | "IMAGE", Promise<FaceLandmarker>>> = {};

function loadLandmarker(mode: "VIDEO" | "IMAGE" = "VIDEO"): Promise<FaceLandmarker> {
	landmarkerPromises[mode] ??= (async () => {
		const vision = await FilesetResolver.forVisionTasks(
			"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
		);
		return FaceLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath:
					"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
			},
			runningMode: mode,
			// IMAGE mode (uploaded reference photo) asks for 2 so we can reject group photos.
			numFaces: mode === "IMAGE" ? 2 : 1,
			outputFaceBlendshapes: mode === "VIDEO",
			outputFacialTransformationMatrixes: mode === "VIDEO",
		});
	})();
	return landmarkerPromises[mode]!;
}

export interface LivenessSample {
	t: number;
	blinkLeft: number;
	blinkRight: number;
	yaw: number;
}

export type ChallengeStep = "blink" | "turn";

interface Blendshape {
	categoryName: string;
	score: number;
}

function blendshapeScore(blendshapes: Blendshape[], name: string): number {
	return blendshapes.find((b) => b.categoryName === name)?.score ?? 0;
}

// Extracts head yaw (left/right rotation, degrees) from MediaPipe's 4x4
// facial transformation matrix (column-major), which maps its canonical face
// model onto the detected face.
function yawFromMatrix(matrix: number[]): number {
	const m02 = matrix[2];
	const m22 = matrix[10];
	return (Math.atan2(m02, m22) * 180) / Math.PI;
}

// MediaPipe alone has no anti-spoofing model — it will happily track a
// printed photo or a screen replay just as confidently as a live face. This
// active challenge (react to a randomized blink/head-turn prompt within a
// short window) defeats the common "hold a static photo up to the camera"
// attack, since a flat image can't blink or show head-turn parallax on
// command. It does NOT defeat a prepared video replay of the real person
// blinking/turning — that needs server-controlled capture or a dedicated
// liveness vendor, which is a known, accepted limitation for this app's
// trust level (a rating community, not KYC-grade identity verification).
export function pickChallenge(): ChallengeStep[] {
	const steps: ChallengeStep[] = ["blink", "turn"];
	return Math.random() < 0.5 ? steps : [...steps].reverse();
}

export interface NormalizedPoint {
	x: number;
	y: number;
}

// Runs a single detection pass against the shared landmarker, for callers
// (framing guidance, embedding capture) that need a one-off read rather than
// the timed challenge loop below. The landmarker is configured for VIDEO
// mode, so this always calls detectForVideo (never .detect()) — but that
// still accepts a static image/canvas source just fine, which is what the
// upload-photo flow uses this for.
export async function detectLandmarksOnce(
	source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<NormalizedPoint[] | null> {
	const landmarker = await loadLandmarker();
	const result = landmarker.detectForVideo(source, performance.now());
	return result.faceLandmarks?.[0] ?? null;
}

// Landmarks for an uploaded still photo. Returns null unless it contains exactly one face.
export async function detectLandmarksInImage(image: HTMLImageElement): Promise<NormalizedPoint[] | null> {
	const landmarker = await loadLandmarker("IMAGE");
	const faces = landmarker.detect(image).faceLandmarks ?? [];
	return faces.length === 1 ? faces[0] : null;
}

// Indices into MediaPipe's public 468-point face mesh topology
// (canonical_face_model). These are the standard, widely-documented
// landmark indices used across many open-source MediaPipe-based aligners —
// not independently re-verified against a live camera in this environment,
// so spot-check alignment quality once this runs in a real browser.
const LEFT_EYE_CORNERS = [33, 133];
const RIGHT_EYE_CORNERS = [362, 263];
const NOSE_TIP = 1;
const MOUTH_LEFT_CORNER = 61;
const MOUTH_RIGHT_CORNER = 291;

export interface FivePointKeypoints {
	leftEye: [number, number];
	rightEye: [number, number];
	nose: [number, number];
	mouthLeft: [number, number];
	mouthRight: [number, number];
}

function avgPoint(
	landmarks: NormalizedPoint[],
	indices: number[],
	videoWidth: number,
	videoHeight: number,
): [number, number] {
	let x = 0;
	let y = 0;
	for (const i of indices) {
		x += landmarks[i].x;
		y += landmarks[i].y;
	}
	return [(x / indices.length) * videoWidth, (y / indices.length) * videoHeight];
}

// Extracts the 5 ArcFace alignment keypoints (in pixel coordinates) from a
// MediaPipe landmark set, for use with src/lib/faceAlign.ts.
export function extractFivePoints(
	landmarks: NormalizedPoint[],
	videoWidth: number,
	videoHeight: number,
): FivePointKeypoints {
	return {
		leftEye: avgPoint(landmarks, LEFT_EYE_CORNERS, videoWidth, videoHeight),
		rightEye: avgPoint(landmarks, RIGHT_EYE_CORNERS, videoWidth, videoHeight),
		nose: [landmarks[NOSE_TIP].x * videoWidth, landmarks[NOSE_TIP].y * videoHeight],
		mouthLeft: [landmarks[MOUTH_LEFT_CORNER].x * videoWidth, landmarks[MOUTH_LEFT_CORNER].y * videoHeight],
		mouthRight: [landmarks[MOUTH_RIGHT_CORNER].x * videoWidth, landmarks[MOUTH_RIGHT_CORNER].y * videoHeight],
	};
}

export interface FaceFraming {
	ok: boolean;
	message: string;
	faceHeightRatio: number;
}

// Thresholds informed by the WIDER FACE recall behavior for face detectors:
// tiny faces in frame recall poorly, faces at a typical webcam distance
// (filling a healthy fraction of the frame) recall well. We approximate
// "webcam distance" as the face bounding box spanning a good chunk of the
// video frame height, roughly centered.
const MIN_FACE_HEIGHT_RATIO = 0.35;
const MAX_FACE_HEIGHT_RATIO = 0.85;

export function getFaceFraming(landmarks: NormalizedPoint[] | null): FaceFraming {
	if (!landmarks || landmarks.length === 0) {
		return { ok: false, message: "No face detected — center yourself in frame", faceHeightRatio: 0 };
	}

	let minX = 1;
	let maxX = 0;
	let minY = 1;
	let maxY = 0;
	for (const p of landmarks) {
		if (p.x < minX) minX = p.x;
		if (p.x > maxX) maxX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.y > maxY) maxY = p.y;
	}

	const faceHeightRatio = maxY - minY;
	const centerX = (minX + maxX) / 2;

	if (faceHeightRatio < MIN_FACE_HEIGHT_RATIO) {
		return { ok: false, message: "Move closer to the camera", faceHeightRatio };
	}
	if (faceHeightRatio > MAX_FACE_HEIGHT_RATIO) {
		return { ok: false, message: "Move back a little", faceHeightRatio };
	}
	if (centerX < 0.3 || centerX > 0.7) {
		return { ok: false, message: "Center your face in frame", faceHeightRatio };
	}
	return { ok: true, message: "Good — hold still", faceHeightRatio };
}

export async function runLivenessCapture(
	video: HTMLVideoElement,
	options: { durationMs?: number; onSample?: (sample: LivenessSample) => void } = {},
): Promise<{ samples: LivenessSample[] }> {
	const { durationMs = 6000, onSample } = options;
	const landmarker = await loadLandmarker();
	const samples: LivenessSample[] = [];
	const start = performance.now();

	return new Promise((resolve) => {
		function tick() {
			const now = performance.now();
			const elapsed = now - start;
			if (elapsed > durationMs) {
				resolve({ samples });
				return;
			}

			const result = landmarker.detectForVideo(video, now);
			const blendshapes = result.faceBlendshapes?.[0]?.categories as Blendshape[] | undefined;
			const matrix = result.facialTransformationMatrixes?.[0]?.data;

			if (blendshapes?.length && matrix) {
				const sample: LivenessSample = {
					t: elapsed,
					blinkLeft: blendshapeScore(blendshapes, "eyeBlinkLeft"),
					blinkRight: blendshapeScore(blendshapes, "eyeBlinkRight"),
					yaw: yawFromMatrix(matrix),
				};
				samples.push(sample);
				onSample?.(sample);
			}

			requestAnimationFrame(tick);
		}
		requestAnimationFrame(tick);
	});
}
