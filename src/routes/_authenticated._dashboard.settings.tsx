import { createFileRoute, useRouter } from "@tanstack/react-router";

import { getSidebarInfoFn } from "../server/people";
import { getCurrentUserFn } from "../server/auth";
import { authClient } from "../lib/auth-client";
import { Avatar } from "../components/Avatar";

export const Route = createFileRoute("/_authenticated/_dashboard/settings")({
	loader: async () => {
		const [me, session] = await Promise.all([getSidebarInfoFn(), getCurrentUserFn()]);
		return { ...me, email: session?.email ?? "" };
	},
	component: SettingsPage,
});

function SettingsPage() {
	const me = Route.useLoaderData();
	const router = useRouter();

	return (
		<>
			<div className="font-display text-3xl font-extrabold">Settings</div>

			<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-6 flex items-center gap-4 max-w-lg">
				<Avatar id={me.id} name={me.name} image={me.image} size="lg" />
				<div>
					<div className="text-sm font-bold">{me.name}</div>
					<div className="text-xs text-rankd-faint mt-0.5">@{me.username}</div>
					<div className="text-xs text-rankd-faint mt-0.5">{me.email}</div>
				</div>
			</div>

			<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-6 max-w-lg flex items-center justify-between">
				<div>
					<div className="text-sm font-bold">Sign out</div>
					<div className="text-xs text-rankd-faint mt-0.5">End your session on this device.</div>
				</div>
				<button
					type="button"
					onClick={async () => {
						await authClient.signOut();
						await router.invalidate();
						await router.navigate({ to: "/login" });
					}}
					className="px-4 py-2.5 rounded-lg text-sm font-bold border border-rankd-border"
				>
					Log out
				</button>
			</div>
		</>
	);
}
