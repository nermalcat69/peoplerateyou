import { createFileRoute } from "@tanstack/react-router";

import { getRatingsPageFn } from "../server/people";
import { Avatar } from "../components/Avatar";

export const Route = createFileRoute("/_authenticated/_dashboard/ratings")({
	loader: () => getRatingsPageFn(),
	component: RatingsPage,
});

function RatingsPage() {
	const data = Route.useLoaderData();

	return (
		<>
			<div className="font-display text-3xl font-extrabold">Ratings</div>

			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<MiniStat label="Total People Rated" value={data.totalPeopleRated} accent="text-rankd-accent" />
				<MiniStat
					label="Average Rating Given"
					value={data.averageRatingGiven === null ? "—" : data.averageRatingGiven.toFixed(1)}
					accent="text-rankd-yellow"
				/>
				<MiniStat label="Highest Rating Given" value={data.highestRatingGiven ?? "—"} accent="text-rankd-pink" />
				<MiniStat label="Ratings This Month" value={data.ratingsThisMonth} accent="text-rankd-purple" />
			</div>

			<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-6 flex flex-col gap-4">
				<div className="font-display text-xl font-extrabold">Rating Distribution</div>
				<div className="flex flex-col gap-3">
					{data.distribution.map((row) => (
						<div key={row.bucket} className="flex items-center gap-3">
							<div className="w-12 text-xs font-bold text-rankd-faint">{row.bucket}</div>
							<div className="flex-1 h-3.5 rounded-full bg-rankd-elev-2 overflow-hidden">
								<div className="h-full rounded-full bg-rankd-accent" style={{ width: `${row.pct}%` }} />
							</div>
							<div className="w-7 text-right text-xs font-bold text-rankd-dim">{row.count}</div>
						</div>
					))}
				</div>
			</div>

			<div className="flex flex-col gap-4">
				<div className="font-display text-xl font-extrabold">Recent Activity</div>
				{data.recentActivity.length === 0 ? (
					<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-6 text-sm text-rankd-faint text-center">
						No ratings yet.
					</div>
				) : (
					<div className="flex flex-col gap-2.5">
						{data.recentActivity.map((r) => (
							<div key={r.id} className="rounded-2xl bg-rankd-elev border border-rankd-border px-4 py-3.5 flex items-center gap-3.5">
								<Avatar id={r.id} name={r.name} image={r.image} size="sm" />
								<div className="flex-1 min-w-0">
									<div className="text-sm font-bold truncate">{r.name}</div>
									<div className="text-xs text-rankd-faint mt-0.5">{timeAgo(r.createdAt)}</div>
								</div>
								<div className="font-display text-lg font-extrabold text-rankd-accent">{r.score.toFixed(1)}</div>
							</div>
						))}
					</div>
				)}
			</div>
		</>
	);
}

function MiniStat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
	return (
		<div className="rounded-2xl bg-rankd-elev border border-rankd-border px-5 py-4">
			<div className={`font-display text-2xl font-extrabold ${accent}`}>{value}</div>
			<div className="text-[11px] font-bold text-rankd-faint tracking-wide mt-1.5">{label.toUpperCase()}</div>
		</div>
	);
}

function timeAgo(iso: string): string {
	const ms = Date.now() - new Date(`${iso.replace(" ", "T")}Z`).getTime();
	const days = Math.floor(ms / (1000 * 60 * 60 * 24));
	if (days <= 0) return "today";
	if (days === 1) return "1 day ago";
	if (days < 7) return `${days} days ago`;
	const weeks = Math.floor(days / 7);
	if (weeks === 1) return "1 week ago";
	if (weeks < 5) return `${weeks} weeks ago`;
	return new Date(`${iso.replace(" ", "T")}Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
