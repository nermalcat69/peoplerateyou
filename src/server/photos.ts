import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "./auth";
import { cfEnv } from "./cf-env";
import { buildSignedPhotoUrl } from "./image-url";
import { moderateImage } from "./moderation";
import { assertNotSpam } from "./spam";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg"]);
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
const STORE_MAX_DIM = 1600;

function validateUpload(data: unknown) {
	if (!(data instanceof FormData)) throw new Error("Expected FormData");
	const file = data.get("file");
	if (!(file instanceof File)) throw new Error("No file provided");
	if (!ALLOWED_TYPES.has(file.type)) throw new Error("Only PNG or JPEG images are allowed");
	if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image is too large (max 20MB)");
	return { file };
}

export const uploadPhotoFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validateUpload)
	.handler(async ({ data, context }) => {
		const env = await cfEnv();
		const { success } = await env.UPLOAD_RATE_LIMITER.limit({ key: context.user.id });
		if (!success) throw new Error("Too many uploads, try again in a minute");

		const originalBytes = await data.file.arrayBuffer();

		const moderation = await moderateImage(originalBytes);
		if (!moderation.safe) throw new Error("Image rejected: violates content policy");

		const stored = await env.IMAGES.input(new Response(originalBytes).body!)
			.transform({ width: STORE_MAX_DIM, height: STORE_MAX_DIM, fit: "scale-down" })
			.output({ format: "image/webp", quality: 82 });
		const storedBytes = await new Response(stored.image()).arrayBuffer();

		const photoId = crypto.randomUUID();
		const r2Key = `photos/${photoId}.webp`;

		await env.PHOTOS.put(r2Key, storedBytes, {
			httpMetadata: { contentType: "image/webp" },
		});

		await env.DB.prepare(
			"INSERT INTO photos (id, owner_id, r2_key, status) VALUES (?, ?, ?, 'active')",
		)
			.bind(photoId, context.user.id, r2Key)
			.run();

		return { id: photoId };
	});

interface FeedRow {
	id: string;
	ownerDisplayName: string;
	createdAt: string;
	avgScore: number | null;
	ratingCount: number;
	commentCount: number;
	myScore: number | null;
}

export const listFeedFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const env = await cfEnv();
		const { results } = await env.DB.prepare(
			`SELECT
				 p.id as id,
				 u.name as ownerDisplayName,
				 p.created_at as createdAt,
				 (SELECT AVG(score) FROM ratings WHERE photo_id = p.id) as avgScore,
				 (SELECT COUNT(*) FROM ratings WHERE photo_id = p.id) as ratingCount,
				 (SELECT COUNT(*) FROM comments WHERE photo_id = p.id) as commentCount,
				 (SELECT score FROM ratings WHERE photo_id = p.id AND rater_id = ?) as myScore
			 FROM photos p
			 JOIN "user" u ON u.id = p.owner_id
			 WHERE p.status = 'active' AND p.owner_id != ?
			 ORDER BY p.created_at DESC
			 LIMIT 50`,
		)
			.bind(context.user.id, context.user.id)
			.all<FeedRow>();

		return Promise.all(
			results.map(async (row) => ({
				...row,
				imageUrl: await buildSignedPhotoUrl(row.id),
			})),
		);
	});

function validateRating(data: unknown) {
	if (typeof data !== "object" || data === null) throw new Error("Invalid input");
	const { photoId, score } = data as Record<string, unknown>;
	if (typeof photoId !== "string" || !photoId) throw new Error("Invalid photo");
	if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 10)
		throw new Error("Score must be an integer between 0 and 10");
	return { photoId, score };
}

export const ratePhotoFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validateRating)
	.handler(async ({ data, context }) => {
		const env = await cfEnv();
		const { success } = await env.RATING_RATE_LIMITER.limit({ key: context.user.id });
		if (!success) throw new Error("Too many ratings, try again in a minute");

		const photo = await env.DB.prepare("SELECT owner_id FROM photos WHERE id = ? AND status = 'active'")
			.bind(data.photoId)
			.first<{ owner_id: string }>();
		if (!photo) throw new Error("Photo not found");
		if (photo.owner_id === context.user.id) throw new Error("You can't rate your own photo");

		await env.DB.prepare(
			`INSERT INTO ratings (photo_id, rater_id, score) VALUES (?, ?, ?)
			 ON CONFLICT (photo_id, rater_id) DO UPDATE SET score = excluded.score, created_at = CURRENT_TIMESTAMP`,
		)
			.bind(data.photoId, context.user.id, data.score)
			.run();

		return { success: true };
	});

function validateComment(data: unknown) {
	if (typeof data !== "object" || data === null) throw new Error("Invalid input");
	const { photoId, body } = data as Record<string, unknown>;
	if (typeof photoId !== "string" || !photoId) throw new Error("Invalid photo");
	if (typeof body !== "string" || body.trim().length < 1 || body.length > 500)
		throw new Error("Comment must be 1-500 characters");
	const trimmed = body.trim().replace(/\s+/g, " ");
	assertNotSpam(trimmed);
	return { photoId, body: trimmed };
}

export const addCommentFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validateComment)
	.handler(async ({ data, context }) => {
		const env = await cfEnv();
		const { success } = await env.COMMENT_RATE_LIMITER.limit({ key: context.user.id });
		if (!success) throw new Error("Too many comments, try again in a minute");

		const photo = await env.DB.prepare("SELECT id FROM photos WHERE id = ? AND status = 'active'")
			.bind(data.photoId)
			.first();
		if (!photo) throw new Error("Photo not found");

		const lastComment = await env.DB.prepare(
			"SELECT body FROM comments WHERE author_id = ? ORDER BY created_at DESC LIMIT 1",
		)
			.bind(context.user.id)
			.first<{ body: string }>();
		if (lastComment && lastComment.body === data.body) throw new Error("You just posted that — try something new");

		const commentId = crypto.randomUUID();
		await env.DB.prepare(
			"INSERT INTO comments (id, photo_id, author_id, body) VALUES (?, ?, ?, ?)",
		)
			.bind(commentId, data.photoId, context.user.id, data.body)
			.run();

		return {
			id: commentId,
			body: data.body,
			authorDisplayName: context.user.name,
			createdAt: new Date().toISOString(),
		};
	});

function validateListComments(data: unknown) {
	if (typeof data !== "object" || data === null) throw new Error("Invalid input");
	const { photoId } = data as Record<string, unknown>;
	if (typeof photoId !== "string" || !photoId) throw new Error("Invalid photo");
	return { photoId };
}

export const listCommentsFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(validateListComments)
	.handler(async ({ data }) => {
		const env = await cfEnv();
		const { results } = await env.DB.prepare(
			`SELECT c.id as id, c.body as body, u.name as authorDisplayName, c.created_at as createdAt
			 FROM comments c JOIN "user" u ON u.id = c.author_id
			 WHERE c.photo_id = ?
			 ORDER BY c.created_at ASC
			 LIMIT 100`,
		)
			.bind(data.photoId)
			.all<{ id: string; body: string; authorDisplayName: string; createdAt: string }>();

		return results;
	});
