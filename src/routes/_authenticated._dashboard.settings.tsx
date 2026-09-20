import { createFileRoute, useRouter } from "@tanstack/react-router";

import { getSidebarInfoFn } from "../server/people";
import { getCurrentUserFn } from "../server/auth";
import { listSecurityEventsFn } from "../server/security";
import { authClient } from "../lib/auth-client";
import { describeUserAgent } from "../lib/userAgent";
import { Avatar } from "../components/Avatar";
import { ThemeToggle } from "../components/ThemeToggle";
import { SessionsPanel } from "../components/SessionsPanel";

export const Route = createFileRoute("/_authenticated/_dashboard/settings")({
	loader: async () => {
		const [me, { user }, securityEvents] = await Promise.all([
			getSidebarInfoFn(),
			getCurrentUserFn(),
			listSecurityEventsFn(),
		]);
		return { ...me, email: user?.email ?? "", securityEvents };
	},
	component: SettingsPage,
});

const EVENT_LABEL: Record<string, string> = {
	location_mismatch: "Blocked a login from a different region",
	fingerprint_mismatch: "Blocked a login from a different device",
};

function SettingsPage() {
	const me = Route.useLoaderData();
	const router = useRouter();

	return (
		<>
			<div className="font-display text-3xl font-extrabold">Settings</div>

			<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-6 flex items-center gap-4 max-w-lg">
				<Avatar id={me.id} name={me.name} image={me.image} size="lg" verified={me.verified} />
				<div>
					<div className="text-sm font-bold">{me.name}</div>
					<div className="text-xs text-rankd-faint mt-0.5">@{me.username}</div>
					<div className="text-xs text-rankd-faint mt-0.5">{me.email}</div>
				</div>
			</div>

			<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-6 max-w-lg flex items-center justify-between gap-4">
				<div>
					<div className="text-sm font-bold">Appearance</div>
					<div className="text-xs text-rankd-faint mt-0.5">Choose how RANKD looks on this device.</div>
				</div>
				<ThemeToggle />
			</div>

			<SessionsPanel />

			<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-6 max-w-lg flex flex-col gap-3">
				<div>
					<div className="text-sm font-bold">Recent Security Activity</div>
					<div className="text-xs text-rankd-faint mt-0.5">
						Sessions used from an unexpected region or device are revoked automatically.
					</div>
				</div>
				{me.securityEvents.length === 0 ? (
					<div className="text-xs text-rankd-faint">No suspicious activity detected.</div>
				) : (
					<div className="flex flex-col gap-2">
						{me.securityEvents.map((event) => (
							<div key={event.id} className="rounded-lg bg-rankd-elev-2 px-3 py-2.5">
								<div className="text-xs font-bold text-rankd-pink">
									{EVENT_LABEL[event.eventType] ?? event.eventType}
								</div>
								<div className="text-[11px] text-rankd-faint mt-0.5">
									{describeUserAgent(event.userAgent)} · {event.seenRegion ?? event.seenIp ?? "unknown location"} ·{" "}
									{new Date(`${event.createdAt.replace(" ", "T")}Z`).toLocaleString("en-US", {
										dateStyle: "medium",
										timeStyle: "short",
										timeZone: "UTC",
									})}{" "}
									UTC
								</div>
							</div>
						))}
					</div>
				)}
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
