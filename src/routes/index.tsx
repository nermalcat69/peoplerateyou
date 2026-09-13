import { createFileRoute, redirect } from "@tanstack/react-router";

import { getCurrentUserFn } from "../server/auth";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const user = await getCurrentUserFn();
		throw redirect({ to: user ? "/feed" : "/login" });
	},
});
