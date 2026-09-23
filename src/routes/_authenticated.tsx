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
		// check on the upload-photo route itself to avoid an infinite redirect;
		// /verify-photo doesn't need its own exemption since it's only ever
		// reached after this same check has already passed.
		if (location.pathname !== "/upload-photo") {
			const { hasReferencePhoto } = await getVerificationStatusFn();
			if (!hasReferencePhoto) {
				throw redirect({ to: "/upload-photo" });
			}
		}

		return { user };
	},
	component: () => <Outlet />,
});
