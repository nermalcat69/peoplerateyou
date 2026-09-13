import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { getDashboardFn, updateProfileFn } from "../server/people";
import { Avatar } from "../components/Avatar";
import {
	IconArrowRight,
	IconChevronRight,
	IconEye,
	IconMapPin,
	IconPencil,
	IconStar,
	IconTrendingUp,
	IconUsers,
} from "../components/icons";

export const Route = createFileRoute("/_authenticated/_dashboard/profile")({
	loader: () => getDashboardFn(),
	component: ProfilePage,
});

function ProfilePage() {
	const data = Route.useLoaderData();
	const router = useRouter();
	const [editing, setEditing] = useState(false);

	return (
		<>
			<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-6 md:p-8 flex flex-col md:flex-row gap-6">
				<Avatar id={data.id} name={data.name} image={data.image} size="2xl" />
				<div className="flex-1 min-w-0 flex flex-col gap-2.5">
					<div className="flex items-start justify-between gap-4 flex-wrap">
						<div>
							<div className="font-display text-3xl font-extrabold leading-none">{data.name}</div>
							<div className="text-sm text-rankd-faint mt-1.5">@{data.username}</div>
						</div>
						<button
							type="button"
							onClick={() => setEditing((v) => !v)}
							className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border border-rankd-border"
						>
							<IconPencil />
							{editing ? "Cancel" : "Edit Profile"}
						</button>
					</div>

					{editing ? (
						<EditProfileForm
							bio={data.bio}
							location={data.location}
							onSaved={async () => {
								setEditing(false);
								await router.invalidate();
							}}
						/>
					) : (
						<>
							<p className="text-sm text-rankd-dim max-w-lg">
								{data.bio || "No bio yet — add one so people know who they're rating."}
							</p>
							<div className="flex items-center gap-1.5 text-sm text-rankd-faint">
								<IconMapPin />
								{data.location || "Location not set"} &nbsp;·&nbsp; Joined{" "}
								{new Date(data.joinedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
							</div>
						</>
					)}

					<div className="mt-2 max-w-sm">
						<div className="flex justify-between text-[11px] font-bold text-rankd-faint mb-1.5 tracking-wide">
							<span>PROFILE STRENGTH</span>
							<span className="text-rankd-green">{data.profileCompletion}%</span>
						</div>
						<div className="h-1.5 rounded-full bg-rankd-elev-2 overflow-hidden">
							<div className="h-full bg-rankd-green rounded-full" style={{ width: `${data.profileCompletion}%` }} />
						</div>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<StatCard label="People Rated" value={data.stats.peopleRated} sub={`+${data.stats.ratingsThisMonth} this month`} accent="green" icon="users" />
				<StatCard
					label="Rating Activity"
					value={data.stats.peopleRated}
					sub="ratings given"
					accent="blue"
					icon="trending"
				/>
				<StatCard
					label="Avg Rating Given"
					value={data.stats.avgRatingGiven === null ? "—" : data.stats.avgRatingGiven.toFixed(1)}
					sub="out of 10"
					accent="yellow"
					icon="star"
				/>
				<StatCard
					label="Profile Views"
					value={data.stats.profileViews.toLocaleString()}
					sub={`+${data.stats.profileViewsThisWeek} this week`}
					accent="purple"
					icon="eye"
				/>
			</div>

			<div className="rounded-2xl bg-rankd-green/10 border border-rankd-green p-6 md:p-7 flex flex-col md:flex-row items-center justify-between gap-5">
				<div>
					<div className="font-display text-xl md:text-2xl font-extrabold">Ready to rate someone new?</div>
					<div className="text-sm text-rankd-dim mt-1.5">Discover new profiles and grow your reputation as a rater.</div>
				</div>
				<Link
					to="/discover"
					className="flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-bold bg-rankd-green text-rankd-ink shrink-0"
				>
					Rate Someone
					<IconArrowRight />
				</Link>
			</div>

			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<div className="font-display text-xl font-extrabold">Recent Ratings</div>
					<Link to="/people-rated" className="flex items-center gap-1 text-sm font-bold text-rankd-green">
						View All
						<IconChevronRight />
					</Link>
				</div>

				{data.recentRatings.length === 0 ? (
					<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-6 text-sm text-rankd-faint text-center">
						You haven't rated anyone yet. Head to Discover to get started.
					</div>
				) : (
					<div className="flex flex-col gap-2.5">
						{data.recentRatings.map((r) => (
							<div key={r.id} className="rounded-2xl bg-rankd-elev border border-rankd-border px-4 py-3.5 flex items-center gap-3.5">
								<Avatar id={r.id} name={r.name} image={r.image} />
								<div className="flex-1 min-w-0">
									<div className="text-sm font-bold truncate">{r.name}</div>
									<div className="text-xs text-rankd-faint mt-0.5">
										@{r.username} · {timeAgo(r.createdAt)}
									</div>
								</div>
								<div className="font-display text-xl font-extrabold text-rankd-green">{r.score.toFixed(1)}</div>
								<Link
									to="/people/$userId"
									params={{ userId: r.id }}
									className="px-3.5 py-2 rounded-lg text-xs font-bold border border-rankd-border shrink-0"
								>
									View Profile
								</Link>
							</div>
						))}
					</div>
				)}
			</div>
		</>
	);
}

const ACCENT_TEXT = {
	green: "text-rankd-green",
	blue: "text-rankd-blue",
	yellow: "text-rankd-yellow",
	purple: "text-rankd-purple",
} as const;

const ACCENT_BG = {
	green: "bg-rankd-green/15",
	blue: "bg-rankd-blue/15",
	yellow: "bg-rankd-yellow/15",
	purple: "bg-rankd-purple/15",
} as const;

function StatCard({
	label,
	value,
	sub,
	accent,
	icon,
}: {
	label: string;
	value: string | number;
	sub: string;
	accent: keyof typeof ACCENT_TEXT;
	icon: "users" | "trending" | "star" | "eye";
}) {
	return (
		<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-5 flex flex-col gap-4">
			<div className={`size-9 rounded-[10px] flex items-center justify-center ${ACCENT_BG[accent]}`}>
				<StatIcon icon={icon} className={ACCENT_TEXT[accent]} />
			</div>
			<div>
				<div className="font-display text-3xl font-extrabold leading-none">{value}</div>
				<div className="text-[11px] font-bold text-rankd-faint tracking-wide mt-2">{label.toUpperCase()}</div>
			</div>
			<div className={`text-xs font-semibold ${ACCENT_TEXT[accent]}`}>{sub}</div>
		</div>
	);
}

function StatIcon({ icon, className }: { icon: "users" | "trending" | "star" | "eye"; className?: string }) {
	if (icon === "users") return <IconUsers size={18} className={className} />;
	if (icon === "trending") return <IconTrendingUp size={18} className={className} />;
	if (icon === "star") return <IconStar size={18} className={className} />;
	return <IconEye size={18} className={className} />;
}

function EditProfileForm({
	bio,
	location,
	onSaved,
}: {
	bio: string;
	location: string;
	onSaved: () => void | Promise<void>;
}) {
	const updateProfile = useServerFn(updateProfileFn);
	const [form, setForm] = useState({ bio, location });
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError(null);
		try {
			await updateProfile({ data: form });
			await onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't save profile");
		} finally {
			setSaving(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-2.5 max-w-md">
			<textarea
				value={form.bio}
				onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
				placeholder="Short bio"
				maxLength={280}
				rows={2}
				className="w-full rounded-lg border border-rankd-border bg-rankd-elev-2 px-3 py-2 text-sm text-rankd-text placeholder:text-rankd-faint"
			/>
			<input
				value={form.location}
				onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
				placeholder="Location"
				maxLength={80}
				className="w-full rounded-lg border border-rankd-border bg-rankd-elev-2 px-3 py-2 text-sm text-rankd-text placeholder:text-rankd-faint"
			/>
			{error && <p className="text-xs text-rankd-pink">{error}</p>}
			<button
				type="submit"
				disabled={saving}
				className="self-start px-4 py-2 rounded-lg text-sm font-bold bg-rankd-green text-rankd-ink disabled:opacity-50"
			>
				{saving ? "Saving…" : "Save"}
			</button>
		</form>
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
