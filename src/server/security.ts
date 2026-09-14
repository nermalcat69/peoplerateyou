import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "./auth";
import { cfEnv } from "./cf-env";

export interface SecurityEventRow {
	id: string;
	eventType: "location_mismatch" | "fingerprint_mismatch";
	seenIp: string | null;
	expectedIp: string | null;
	seenRegion: string | null;
	expectedRegion: string | null;
	userAgent: string | null;
	createdAt: string;
}

export const listSecurityEventsFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const env = await cfEnv();
		const { results } = await env.DB.prepare(
			`SELECT id, event_type as eventType, seen_ip as seenIp, expected_ip as expectedIp,
				seen_region as seenRegion, expected_region as expectedRegion,
				user_agent as userAgent, created_at as createdAt
			 FROM security_events
			 WHERE user_id = ?
			 ORDER BY created_at DESC
			 LIMIT 20`,
		)
			.bind(context.user.id)
			.all<SecurityEventRow>();
		return results;
	});
