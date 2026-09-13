import { cfEnv } from "./cf-env";
import { hmacHex } from "./crypto";

const DEFAULT_TTL_SECONDS = 5 * 60;

function tokenMessage(photoId: string, exp: number): string {
	return `${photoId}:${exp}`;
}

export async function signPhotoToken(photoId: string, exp: number): Promise<string> {
	const env = await cfEnv();
	return hmacHex(env.IMAGE_SIGNING_KEY, tokenMessage(photoId, exp));
}

export async function buildSignedPhotoUrl(
	photoId: string,
	ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string> {
	const exp = Date.now() + ttlSeconds * 1000;
	const sig = await signPhotoToken(photoId, exp);
	return `/api/photos/${photoId}/image?exp=${exp}&sig=${sig}`;
}
