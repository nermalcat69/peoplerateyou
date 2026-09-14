import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { betterAuth } from "better-auth";

import { cfEnv } from "./cf-env";
import { computeFingerprint, getRequestGeo } from "./fingerprint";

export const getAuth = createServerOnlyFn(async () => {
	const env = await cfEnv();
	// Same-origin app only, so trust whatever origin the current request
	// actually arrived on (works across localhost, preview, and prod domains).
	const baseURL = new URL(getRequest().url).origin;
	return betterAuth({
		baseURL,
		// Same-origin app: trust whatever origin a request actually arrived
		// on (matters across localhost / preview / prod hostnames).
		trustedOrigins: async (request) => {
			const origin = request?.headers.get("origin");
			return origin ? [origin] : [];
		},
		database: env.DB,
		secret: env.BETTER_AUTH_SECRET,
		emailAndPassword: { enabled: true },
		advanced: {
			ipAddress: {
				// Cloudflare sets this on every request and it can't be
				// spoofed by the client, unlike x-forwarded-for.
				ipAddressHeaders: ["cf-connecting-ip"],
			},
		},
		session: {
			additionalFields: {
				deviceFingerprint: {
					type: "string",
					required: false,
					// Server-computed only — never trust a client-supplied value.
					input: false,
				},
				geoCountry: { type: "string", required: false, input: false },
				geoRegion: { type: "string", required: false, input: false },
			},
		},
		databaseHooks: {
			session: {
				create: {
					before: async (session) => {
						// getRequest() reads from the same per-request AsyncLocalStorage
						// this hook is already running inside of, so no need to thread
						// anything through better-auth's own hook context.
						const request = getRequest();
						const deviceFingerprint = await computeFingerprint(request.headers);
						const geo = getRequestGeo(request);
						return {
							data: { ...session, deviceFingerprint, geoCountry: geo.country, geoRegion: geo.region },
						};
					},
				},
			},
		},
	});
});
