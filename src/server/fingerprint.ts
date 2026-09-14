// Header-based device fingerprint: no client-side collection (canvas, fonts,
// etc.) needed, just a stable hash of the request headers that identify the
// browser/device. Paired with the request's geographic region, this is what
// session hijack detection compares against on every request (see
// session-security.ts).

export function getClientIp(headers: Headers): string | null {
	return headers.get("cf-connecting-ip");
}

export async function computeFingerprint(headers: Headers): Promise<string> {
	const parts = [
		headers.get("user-agent") ?? "",
		headers.get("accept-language") ?? "",
		headers.get("sec-ch-ua") ?? "",
		headers.get("sec-ch-ua-platform") ?? "",
		headers.get("sec-ch-ua-mobile") ?? "",
	].join("|");

	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts));
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export interface RequestGeo {
	country: string | null;
	region: string | null;
}

// Cloudflare stamps every incoming request with a `cf` object resolved from
// its edge network's own IP geolocation — no third-party GeoIP service
// needed, and (per Cloudflare's local dev tooling) it's populated with real
// data in `wrangler dev`/the Vite plugin too, not just in production.
export function getRequestGeo(request: Request): RequestGeo {
	const cf = (request as { cf?: { country?: string | null; regionCode?: string | null } }).cf;
	return {
		country: cf?.country ?? null,
		region: cf?.regionCode ?? null,
	};
}
