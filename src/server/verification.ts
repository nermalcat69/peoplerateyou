import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { authMiddleware } from "./auth";
import { cfEnv } from "./cf-env";
import { computeFingerprint, getClientIp } from "./fingerprint";
import { moderateImage } from "./moderation";

const REFERENCE_MAX_DIM = 800;
const REFERENCE_MAX_BYTES = 8 * 1024 * 1024;
// facex_nano.onnx (see src/lib/faceEmbedding.ts) outputs a fixed 256-dim,
// L2-normalized embedding.
const EMBEDDING_DIM = 256;

// Cosine similarity threshold for "same person". facex-wasm's own SDK
// defaults to 0.3 for FaceX's larger "xs" embedding model; nano is a
// smaller, less accurate model (95.62% LFW vs. xs's 99.07%), so this is a
// starting point, not a calibrated value — revisit once real match-score
// distributions are available from actual usage.
const MATCH_THRESHOLD = 0.4;
const BLINK_THRESHOLD = 0.5;
const YAW_TURN_DEGREES = 15;
const CHALLENGE_MAX_DURATION_MS = 8000;
const HOURLY_ATTEMPT_LIMIT = 5;

// The Workers RateLimit binding only supports 10s/60s windows, so the
// per-minute VERIFICATION_RATE_LIMITER binding only throttles bursts. This
// enforces the real cap: attempts are metered by nothing external (this is
// all in-Worker compute), but the audit table still bounds retry storms.
async function assertUnderHourlyLimit(env: Env, userId: string): Promise<void> {
	const row = await env.DB.prepare(
		"SELECT COUNT(*) as c FROM verification_attempts WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')",
	)
		.bind(userId)
		.first<{ c: number }>();
	if ((row?.c ?? 0) >= HOURLY_ATTEMPT_LIMIT) {
		throw new Error("Too many verification attempts this hour, try again later");
	}
}

function parseEmbedding(raw: unknown): number[] {
	if (!Array.isArray(raw) || raw.length !== EMBEDDING_DIM) {
		throw new Error("Invalid face embedding");
	}
	return raw.map((v) => {
		if (typeof v !== "number" || !Number.isFinite(v)) throw new Error("Invalid face embedding");
		return v;
	});
}

function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length || a.length === 0) return -1;
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	if (normA === 0 || normB === 0) return -1;
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

interface ChallengeSample {
	t: number;
	blinkLeft: number;
	blinkRight: number;
	yaw: number;
}

function parseSamples(raw: unknown): ChallengeSample[] {
	if (!Array.isArray(raw) || raw.length < 4) throw new Error("Invalid liveness samples");
	return raw.map((s) => {
		if (typeof s !== "object" || s === null) throw new Error("Invalid liveness samples");
		const { t, blinkLeft, blinkRight, yaw } = s as Record<string, unknown>;
		for (const v of [t, blinkLeft, blinkRight, yaw]) {
			if (typeof v !== "number" || !Number.isFinite(v)) throw new Error("Invalid liveness samples");
		}
		return { t: t as number, blinkLeft: blinkLeft as number, blinkRight: blinkRight as number, yaw: yaw as number };
	});
}

// Independently re-derives the liveness verdict from the raw per-frame
// landmark/blendshape samples the client captured during the blink + head-turn
// challenge, rather than trusting a client-reported pass/fail flag — without
// this, anyone could skip the camera entirely and POST a fabricated result.
// This still can't catch a prepared video-replay attack (see verify-photo.tsx
// comments); it only closes the "no camera involved at all" gap.
function challengePassed(samples: ChallengeSample[]): boolean {
	if (samples.length === 0) return false;
	const duration = samples[samples.length - 1].t - samples[0].t;
	if (duration <= 0 || duration > CHALLENGE_MAX_DURATION_MS) return false;

	const blinked = samples.some((s) => s.blinkLeft > BLINK_THRESHOLD || s.blinkRight > BLINK_THRESHOLD);
	const yaws = samples.map((s) => s.yaw);
	const turnedHead = Math.max(...yaws) - Math.min(...yaws) >= YAW_TURN_DEGREES;

	return blinked && turnedHead;
}

export const getVerificationStatusFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const env = await cfEnv();
		const [profile, reference] = await Promise.all([
			env.DB.prepare("SELECT verification_status FROM profiles WHERE user_id = ?")
				.bind(context.user.id)
				.first<{ verification_status: string }>(),
			env.DB.prepare("SELECT r2_key FROM verification_photos WHERE user_id = ?")
				.bind(context.user.id)
				.first<{ r2_key: string }>(),
		]);
		// Needs both the D1 row and the R2 object; either one missing (e.g. wiped
		// local R2 state) means the reference photo has to be captured again.
		const hasReferencePhoto = !!reference && !!(await env.PHOTOS.head(reference.r2_key));
		return {
			status: hasReferencePhoto ? (profile?.verification_status ?? "unverified") : "unverified",
			hasReferencePhoto,
		};
	});

function validateReferenceUpload(data: unknown) {
	if (!(data instanceof FormData)) throw new Error("Expected FormData");
	const file = data.get("file");
	if (!(file instanceof File)) throw new Error("No photo provided");
	if (!["image/png", "image/jpeg"].includes(file.type)) throw new Error("Only PNG or JPEG images are allowed");
	if (file.size > REFERENCE_MAX_BYTES) throw new Error("Image is too large (max 8MB)");

	const embeddingRaw = data.get("embedding");
	if (typeof embeddingRaw !== "string") throw new Error("Missing face embedding");
	let parsed: unknown;
	try {
		parsed = JSON.parse(embeddingRaw);
	} catch {
		throw new Error("Missing face embedding");
	}
	return { file, embedding: parseEmbedding(parsed) };
}

// Stores the mandatory "this is me" reference photo captured at onboarding.
// It's kept out of the rateable `photos` table entirely (own R2 prefix, own
// D1 table) so it's never shown to other users and never conflated with a
// post submitted for rating.
export const setReferencePhotoFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validateReferenceUpload)
	.handler(async ({ data, context }) => {
		const env = await cfEnv();
		const { success } = await env.VERIFICATION_RATE_LIMITER.limit({ key: context.user.id });
		if (!success) throw new Error("Too many attempts, try again later");

		const originalBytes = await data.file.arrayBuffer();
		const moderation = await moderateImage(originalBytes);
		if (!moderation.safe) throw new Error("Image rejected: violates content policy");

		const stored = await env.IMAGES.input(new Response(originalBytes).body!)
			.transform({ width: REFERENCE_MAX_DIM, height: REFERENCE_MAX_DIM, fit: "scale-down" })
			.output({ format: "image/webp", quality: 85 });
		const storedBytes = await new Response(stored.image()).arrayBuffer();

		const r2Key = `verification/${context.user.id}.webp`;
		await env.PHOTOS.put(r2Key, storedBytes, { httpMetadata: { contentType: "image/webp" } });

		await env.DB.prepare(
			`INSERT INTO verification_photos (id, user_id, r2_key, embedding) VALUES (?, ?, ?, ?)
			 ON CONFLICT (user_id) DO UPDATE SET r2_key = excluded.r2_key, embedding = excluded.embedding, created_at = CURRENT_TIMESTAMP`,
		)
			.bind(crypto.randomUUID(), context.user.id, r2Key, JSON.stringify(data.embedding))
			.run();

		// A new reference photo invalidates any prior "verified" badge until the
		// person proves liveness against this new photo again.
		await env.DB.prepare("UPDATE profiles SET verification_status = 'pending', verified_at = NULL WHERE user_id = ?")
			.bind(context.user.id)
			.run();

		return { success: true };
	});

function validateCompleteVerification(data: unknown) {
	if (typeof data !== "object" || data === null) throw new Error("Invalid input");
	const { embedding, samples } = data as Record<string, unknown>;
	return { embedding: parseEmbedding(embedding), samples: parseSamples(samples) };
}

// The heavy lifting (face detection, the liveness challenge, computing face
// embeddings) all runs client-side via MediaPipe + ONNX Runtime Web — see
// src/lib/liveness.ts and src/lib/faceEmbedding.ts. This handler is the trust
// boundary: it re-derives the liveness verdict from raw samples and computes
// the match score itself (plain arithmetic, no ML model needed here) instead
// of trusting whatever the client claims, so a forged API call can't grant a
// "verified" badge on its own.
export const completeVerificationFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validateCompleteVerification)
	.handler(async ({ data, context }) => {
		const env = await cfEnv();
		const request = getRequest();
		const { success } = await env.VERIFICATION_RATE_LIMITER.limit({ key: context.user.id });
		if (!success) throw new Error("Too many attempts, try again later");
		await assertUnderHourlyLimit(env, context.user.id);

		const ipAddress = getClientIp(request.headers);
		const deviceFingerprint = await computeFingerprint(request.headers);

		async function logAttempt(decision: string, similarity: number | null, livenessPassed: boolean) {
			await env.DB.prepare(
				`INSERT INTO verification_attempts
					(id, user_id, decision, similarity, liveness_passed, ip_address, device_fingerprint)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
				.bind(
					crypto.randomUUID(),
					context.user.id,
					decision,
					similarity,
					livenessPassed ? 1 : 0,
					ipAddress,
					deviceFingerprint,
				)
				.run();
		}

		if (!challengePassed(data.samples)) {
			await logAttempt("rejected_liveness", null, false);
			return {
				verified: false,
				reason: "We couldn't confirm a live face — make sure you're in good lighting and follow the prompts.",
			};
		}

		const reference = await env.DB.prepare("SELECT embedding, r2_key FROM verification_photos WHERE user_id = ?")
			.bind(context.user.id)
			.first<{ embedding: string; r2_key: string }>();
		if (!reference || !(await env.PHOTOS.head(reference.r2_key))) {
			await logAttempt("rejected_no_reference_photo", null, true);
			return { verified: false, reason: "Add a reference photo first." };
		}

		const similarity = cosineSimilarity(data.embedding, JSON.parse(reference.embedding));
		const matched = similarity >= MATCH_THRESHOLD;
		await logAttempt(matched ? "approved" : "rejected_no_match", similarity, true);

		if (matched) {
			await env.DB.prepare(
				"UPDATE profiles SET verification_status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE user_id = ?",
			)
				.bind(context.user.id)
				.run();
		}

		return {
			verified: matched,
			reason: matched
				? null
				: "That didn't match your reference photo closely enough. Try again with even lighting and no obstructions.",
		};
	});
