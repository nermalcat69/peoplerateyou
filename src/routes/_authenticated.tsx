import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getCurrentUserFn } from "../server/auth";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const { user, revokedReason } = await getCurrentUserFn();
		if (!user) {
			throw redirect({
				to: "/login",
				search: revokedReason ? { security: revokedReason } : undefined,
			});
		}
		return { user };
	},
	component: () => <Outlet />,
});
