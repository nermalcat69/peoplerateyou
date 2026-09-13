import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getCurrentUserFn } from "../server/auth";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const user = await getCurrentUserFn();
		if (!user) throw redirect({ to: "/login" });
		return { user };
	},
	component: () => <Outlet />,
});
