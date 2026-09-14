import { cfEnv } from "./cf-env";
import { computeFingerprint, getClientIp, getRequestGeo } from "./fingerprint";

export type RevokeReason = "location_mismatch" | "fingerprint_mismatch";

export interface SessionForSecurityCheck {
	token: string;
	userId: string;
	ipAddress?: string | null;
	deviceFingerprint?: string | null;
	geoCountry?: string | null;
	geoRegion?: string | null;
}

// A session stays trusted as long as it's used from the same device and the
// same rough region. IP address on its own is too noisy to key off of — ISPs
// rotate addresses, mobile networks hop between towers, wifi <-> cellular
// changes the address entirely — so a bare IP change within the same
// country+region is normal and is NOT flagged. Actually moving to a
// different region, or a different device fingerprint entirely, is treated
// as a stolen token.
export async function detectHijack(
	session: SessionForSecurityCheck,
	request: Request,
): Promise<RevokeReason | null> {
	const currentGeo = getRequestGeo(request);
	const countryChanged = session.geoCountry && currentGeo.country && session.geoCountry !== currentGeo.country;
	const regionChanged = session.geoRegion && currentGeo.region && session.geoRegion !== currentGeo.region;
	if (countryChanged || regionChanged) {
		return "location_mismatch";
	}

	if (session.deviceFingerprint) {
		const currentFingerprint = await computeFingerprint(request.headers);
		if (session.deviceFingerprint !== currentFingerprint) return "fingerprint_mismatch";
	}

	return null;
}

export async function revokeAndLog(
	session: SessionForSecurityCheck,
	request: Request,
	reason: RevokeReason,
): Promise<void> {
	const env = await cfEnv();
	const currentIp = getClientIp(request.headers);
	const currentGeo = getRequestGeo(request);
	const currentFingerprint = await computeFingerprint(request.headers);

	await env.DB.prepare("DELETE FROM session WHERE token = ?").bind(session.token).run();

	await env.DB.prepare(
		`INSERT INTO security_events
			(id, user_id, session_token, event_type, expected_ip, seen_ip, expected_region, seen_region, expected_fingerprint, seen_fingerprint, user_agent)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			crypto.randomUUID(),
			session.userId,
			session.token,
			reason,
			session.ipAddress ?? null,
			currentIp,
			session.geoCountry && session.geoRegion ? `${session.geoRegion}, ${session.geoCountry}` : null,
			currentGeo.region && currentGeo.country ? `${currentGeo.region}, ${currentGeo.country}` : null,
			session.deviceFingerprint ?? null,
			currentFingerprint,
			request.headers.get("user-agent"),
		)
		.run();
}
