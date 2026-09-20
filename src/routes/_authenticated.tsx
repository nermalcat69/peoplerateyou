import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getCurrentUserFn } from "../server/auth";
import { getVerificationStatusFn } from "../server/verification";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async ({ location }) => {
		const { user, revokedReason } = await getCurrentUserFn();
		if (!user) {
			throw redirect({
				to: "/login",
				search: revokedReason ? { security: revokedReason } : undefined,
			});
		}

		// New users must set a "this is me" reference photo before using the
		// rest of the app, so a verified badge always means something. Skip the
		// check on the verify-photo route itself to avoid an infinite redirect.
		if (location.pathname !== "/verify-photo") {
			const { hasReferencePhoto } = await getVerificationStatusFn();
			if (!hasReferencePhoto) {
				throw redirect({ to: "/verify-photo" });
			}
		}

		return { user };
	},
	component: () => <Outlet />,
});
