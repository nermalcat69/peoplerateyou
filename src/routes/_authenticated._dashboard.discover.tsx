import { createFileRoute, Link } from "@tanstack/react-router";

import { listDiscoverFn } from "../server/people";
import { Avatar } from "../components/Avatar";
import { IconMapPin } from "../components/icons";

export const Route = createFileRoute("/_authenticated/_dashboard/discover")({
	loader: () => listDiscoverFn(),
	component: DiscoverPage,
});

function DiscoverPage() {
	const people = Route.useLoaderData();

	return (
		<>
			<div className="font-display text-3xl font-extrabold">Discover</div>

			{people.length === 0 ? (
				<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-8 text-sm text-rankd-faint text-center">
					You've rated everyone on the platform so far — check back later for new profiles.
				</div>
			) : (
				<div className="grid md:grid-cols-2 gap-4">
					{people.map((p) => (
						<div key={p.id} className="rounded-2xl bg-rankd-elev border border-rankd-border p-6 flex flex-col gap-4">
							<div className="flex items-center gap-3.5">
								<Avatar id={p.id} name={p.name} image={p.image} size="lg" />
								<div className="min-w-0">
									<div className="text-base font-bold truncate">{p.name}</div>
									<div className="text-xs text-rankd-faint mt-0.5 flex items-center gap-1">
										@{p.username}
										{p.location && (
											<>
												<span>·</span>
												<IconMapPin size={12} />
												{p.location}
											</>
										)}
									</div>
								</div>
							</div>
							<p className="text-sm text-rankd-dim leading-relaxed">{p.bio || "This person hasn't added a bio yet."}</p>
							<div className="flex gap-2.5">
								<Link
									to="/people/$userId"
									params={{ userId: p.id }}
									className="flex-1 text-center py-2.5 rounded-lg text-xs font-bold border border-rankd-border"
								>
									View Profile
								</Link>
								<Link
									to="/people/$userId"
									params={{ userId: p.id }}
									className="flex-1 text-center py-2.5 rounded-lg text-xs font-bold bg-rankd-green text-rankd-ink"
								>
									Rate
								</Link>
							</div>
						</div>
					))}
				</div>
			)}
		</>
	);
}
