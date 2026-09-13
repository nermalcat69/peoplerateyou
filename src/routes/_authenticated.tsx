import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";

import { getCurrentUserFn } from "../server/auth";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const user = await getCurrentUserFn();
		if (!user) throw redirect({ to: "/login" });
		return { user };
	},
	component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
	const { user } = Route.useRouteContext();
	const router = useRouter();

	return (
		<div className="max-w-2xl mx-auto px-4">
			<header className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
				<span className="font-semibold">PeopleRateYou</span>
				<div className="flex items-center gap-3 text-sm">
					<span className="text-gray-500">{user.name}</span>
					<button
						type="button"
						className="text-blue-700 dark:text-blue-500 hover:underline"
						onClick={async () => {
							await authClient.signOut();
							await router.invalidate();
							await router.navigate({ to: "/login" });
						}}
					>
						Log out
					</button>
				</div>
			</header>
			<Outlet />
		</div>
	);
}
