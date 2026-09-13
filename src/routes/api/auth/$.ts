import { createFileRoute } from "@tanstack/react-router";

import { getAuth } from "../../../server/auth-instance";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: async ({ request }) => (await getAuth()).handler(request),
			POST: async ({ request }) => (await getAuth()).handler(request),
		},
	},
});
