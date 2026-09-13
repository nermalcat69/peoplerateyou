import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { betterAuth } from "better-auth";

import { cfEnv } from "./cf-env";

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
	});
});
