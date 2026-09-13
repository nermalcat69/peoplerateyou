import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { listPeopleRatedFn } from "../server/people";
import { Avatar } from "../components/Avatar";
import { IconSearch } from "../components/icons";

export const Route = createFileRoute("/_authenticated/_dashboard/people-rated")({
	loader: () => listPeopleRatedFn(),
	component: PeopleRatedPage,
});

const SORTS = ["Recent", "Highest Rated", "Name"] as const;
type Sort = (typeof SORTS)[number];

function PeopleRatedPage() {
	const people = Route.useLoaderData();
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<Sort>("Recent");

	const visible = useMemo(() => {
		const filtered = people.filter(
			(p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.username.toLowerCase().includes(query.toLowerCase()),
		);
		const sorted = [...filtered];
		if (sort === "Highest Rated") sorted.sort((a, b) => b.score - a.score);
		else if (sort === "Name") sorted.sort((a, b) => a.name.localeCompare(b.name));
		else sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		return sorted;
	}, [people, query, sort]);

	return (
		<>
			<div className="flex items-center justify-between gap-4 flex-wrap">
				<div className="font-display text-3xl font-extrabold">People Rated</div>
				<div className="flex gap-2.5 flex-wrap">
					<label className="flex items-center gap-2 rounded-xl bg-rankd-elev border border-rankd-border px-3.5 py-2.5 w-56">
						<IconSearch className="text-rankd-faint" />
						<input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search people..."
							className="bg-transparent text-sm text-rankd-text placeholder:text-rankd-faint outline-none w-full"
						/>
					</label>
					<select
						value={sort}
						onChange={(e) => setSort(e.target.value as Sort)}
						className="rounded-xl bg-rankd-elev border border-rankd-border px-3.5 py-2.5 text-xs font-bold text-rankd-text outline-none"
					>
						{SORTS.map((s) => (
							<option key={s} value={s}>
								Sort: {s}
							</option>
						))}
					</select>
				</div>
			</div>

			{visible.length === 0 ? (
				<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-8 text-sm text-rankd-faint text-center">
					{people.length === 0 ? "You haven't rated anyone yet." : "No one matches your search."}
				</div>
			) : (
				<div className="grid md:grid-cols-2 gap-4">
					{visible.map((p) => (
						<div key={p.id} className="rounded-2xl bg-rankd-elev border border-rankd-border p-5 flex items-center gap-4">
							<Avatar id={p.id} name={p.name} image={p.image} size="lg" />
							<div className="flex-1 min-w-0">
								<div className="text-sm font-bold truncate">{p.name}</div>
								<div className="text-xs text-rankd-faint mt-0.5">@{p.username}</div>
								<div className="text-[11px] text-rankd-faint mt-2">
									Rated {new Date(`${p.createdAt.replace(" ", "T")}Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
								</div>
							</div>
							<div className="flex flex-col items-end gap-2.5">
								<div className="font-display text-2xl font-extrabold text-rankd-green">{p.score.toFixed(1)}</div>
								<Link
									to="/people/$userId"
									params={{ userId: p.id }}
									className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-rankd-border"
								>
									View Profile
								</Link>
							</div>
						</div>
					))}
				</div>
			)}
		</>
	);
}
