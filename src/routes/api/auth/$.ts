import { createFileRoute } from "@tanstack/react-router";

import { getAuth } from "../../../server/auth-instance";
import { cfEnv } from "../../../server/cf-env";
import { getClientIp } from "../../../server/fingerprint";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: async ({ request }) => (await getAuth()).handler(request),
			POST: async ({ request }) => {
				const env = await cfEnv();
				const ip = getClientIp(request.headers) ?? "unknown";
				// Covers sign-in, sign-up, forget/reset-password, etc. — anything an
				// attacker could brute-force or bulk-abuse from a single IP.
				const { success } = await env.AUTH_RATE_LIMITER.limit({ key: ip });
				if (!success) return new Response("Too many attempts, try again in a minute", { status: 429 });

				return (await getAuth()).handler(request);
			},
		},
	},
});
