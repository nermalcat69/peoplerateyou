import { useEffect, useState } from "react";

import { authClient } from "../lib/auth-client";
import { describeUserAgent } from "../lib/userAgent";

interface SessionRow {
	id: string;
	token: string;
	ipAddress?: string | null;
	userAgent?: string | null;
	geoCountry?: string | null;
	geoRegion?: string | null;
	createdAt: string | Date;
}

export function SessionsPanel() {
	const { data: current } = authClient.useSession();
	const [sessions, setSessions] = useState<SessionRow[] | null>(null);
	const [busyToken, setBusyToken] = useState<string | null>(null);
	const [revokingOthers, setRevokingOthers] = useState(false);

	async function refresh() {
		const { data } = await authClient.listSessions();
		setSessions((data as SessionRow[] | null) ?? []);
	}

	useEffect(() => {
		refresh();
	}, []);

	async function handleRevoke(token: string) {
		setBusyToken(token);
		try {
			await authClient.revokeSession({ token });
			await refresh();
		} finally {
			setBusyToken(null);
		}
	}

	async function handleRevokeOthers() {
		setRevokingOthers(true);
		try {
			await authClient.revokeOtherSessions();
			await refresh();
		} finally {
			setRevokingOthers(false);
		}
	}

	const currentToken = current?.session.token;
	const otherCount = sessions?.filter((s) => s.token !== currentToken).length ?? 0;

	return (
		<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-6 max-w-lg flex flex-col gap-4">
			<div className="flex items-center justify-between gap-4">
				<div>
					<div className="text-sm font-bold">Active Sessions</div>
					<div className="text-xs text-rankd-faint mt-0.5">
						Every session is checked against the region and device it started on.
					</div>
				</div>
				{otherCount > 0 && (
					<button
						type="button"
						onClick={handleRevokeOthers}
						disabled={revokingOthers}
						className="px-3 py-2 rounded-lg text-xs font-bold border border-rankd-border shrink-0 disabled:opacity-50"
					>
						{revokingOthers ? "Signing out…" : "Log out other devices"}
					</button>
				)}
			</div>

			{sessions === null ? (
				<div className="text-xs text-rankd-faint">Loading…</div>
			) : (
				<div className="flex flex-col gap-2">
					{sessions.map((s) => {
						const isCurrent = s.token === currentToken;
						return (
							<div
								key={s.id}
								className="flex items-center justify-between gap-3 rounded-lg bg-rankd-elev-2 px-3 py-2.5"
							>
								<div className="min-w-0">
									<div className="text-xs font-bold truncate">
										{describeUserAgent(s.userAgent)}
										{isCurrent && <span className="text-rankd-accent"> · This device</span>}
									</div>
									<div className="text-[11px] text-rankd-faint mt-0.5">
										{s.geoRegion && s.geoCountry ? `${s.geoRegion}, ${s.geoCountry}` : (s.ipAddress ?? "Unknown location")} ·{" "}
										{new Date(s.createdAt).toLocaleDateString("en-US")}
									</div>
								</div>
								{!isCurrent && (
									<button
										type="button"
										onClick={() => handleRevoke(s.token)}
										disabled={busyToken === s.token}
										className="text-xs font-bold text-rankd-pink shrink-0 disabled:opacity-50"
									>
										{busyToken === s.token ? "…" : "Revoke"}
									</button>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
