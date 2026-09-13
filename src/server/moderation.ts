import { cfEnv } from "./cf-env";

const MODERATION_MAX_DIM = 384;

const MODERATION_PROMPT =
	"You are a strict content moderator for a photo-rating community site where people upload photos of themselves to be rated. " +
	"Look at the image and answer with exactly one word first: SAFE or UNSAFE. " +
	"Answer UNSAFE if the image contains nudity, sexual content, graphic violence or gore, or appears to involve a minor in an inappropriate context. " +
	"Otherwise answer SAFE. Optionally add a brief reason after the one word.";

export interface ModerationResult {
	safe: boolean;
	reason: string;
}

// ponytail: Cloudflare Workers AI has no purpose-built NSFW image classifier
// (only generic ImageNet classification and text-only Llama Guard). This uses
// a vision-language model prompted as a moderator instead, so it's a heuristic,
// not a calibrated classifier. Upgrade path if false negatives/positives become
// a problem: a dedicated moderation API (e.g. Hive, Sightengine, AWS Rekognition).
export async function moderateImage(bytes: ArrayBuffer): Promise<ModerationResult> {
	const env = await cfEnv();
	const preview = await env.IMAGES.input(new Response(bytes).body!)
		.transform({ width: MODERATION_MAX_DIM, height: MODERATION_MAX_DIM, fit: "scale-down" })
		.output({ format: "image/jpeg", quality: 80 });
	const previewBytes = await new Response(preview.image()).arrayBuffer();

	const result = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
		prompt: MODERATION_PROMPT,
		image: Array.from(new Uint8Array(previewBytes)),
		max_tokens: 40,
	});

	const text = (result.response ?? "").trim();
	const safe = !/^unsafe\b/i.test(text);
	return { safe, reason: text || (safe ? "safe" : "unsafe") };
}
