import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { getPersonFn, rateUserFn } from "../server/people";
import { Avatar } from "../components/Avatar";
import { RatingScale } from "../components/RatingScale";
import { IconChevronLeft, IconMapPin } from "../components/icons";

export const Route = createFileRoute("/_authenticated/_dashboard/people/$userId")({
	loader: ({ params }) => getPersonFn({ data: { userId: params.userId } }),
	component: PersonDetailPage,
});

function PersonDetailPage() {
	const person = Route.useLoaderData();
	const router = useRouter();
	const rateUser = useServerFn(rateUserFn);
	const [pending, setPending] = useState<number | null>(null);
	const [myRating, setMyRating] = useState(person.myRating);

	async function handleRate(score: number) {
		setPending(score);
		try {
			await rateUser({ data: { userId: person.id, score } });
			setMyRating(score);
			await router.invalidate();
		} finally {
			setPending(null);
		}
	}

	return (
		<>
			<Link to="/discover" className="flex items-center gap-1.5 text-sm font-bold w-fit">
				<IconChevronLeft />
				Back to Discover
			</Link>

			<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center md:items-start">
				<Avatar id={person.id} name={person.name} image={person.image} size="xl" verified={person.verified} />
				<div className="flex-1 min-w-0 flex flex-col gap-2 text-center md:text-left">
					<div className="font-display text-3xl font-extrabold leading-none">{person.name}</div>
					<div className="text-sm text-rankd-faint">@{person.username}</div>
					<div className="flex items-center justify-center md:justify-start gap-1.5 text-sm text-rankd-faint">
						<IconMapPin />
						{person.location || "Location not set"} &nbsp;·&nbsp; Joined{" "}
						{new Date(person.joinedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
					</div>
					<div className="flex justify-center md:justify-start gap-7 mt-2">
						<div>
							<div className="font-display text-xl font-extrabold text-rankd-yellow">
								{person.avgRatingReceived === null ? "—" : person.avgRatingReceived.toFixed(1)}
							</div>
							<div className="text-[11px] font-bold text-rankd-faint tracking-wide mt-0.5">AVG RATING RECEIVED</div>
						</div>
						<div>
							<div className="font-display text-xl font-extrabold">{person.timesRated}</div>
							<div className="text-[11px] font-bold text-rankd-faint tracking-wide mt-0.5">TIMES RATED</div>
						</div>
					</div>
				</div>
			</div>

			<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-6">
				<div className="font-display text-lg font-extrabold mb-2.5">About</div>
				<p className="text-sm text-rankd-dim leading-relaxed">{person.bio || "This person hasn't added a bio yet."}</p>
			</div>

			{person.isSelf ? (
				<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-6 text-sm text-rankd-faint text-center">
					This is your own profile — head to Discover to rate someone else.
				</div>
			) : (
				<div className="rounded-2xl bg-rankd-elev border border-rankd-accent p-6 flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<div className="font-display text-lg font-extrabold">Your Rating</div>
						{myRating !== null && (
							<div className="font-display text-3xl font-extrabold text-rankd-accent">{myRating.toFixed(1)}</div>
						)}
					</div>
					<RatingScale value={myRating} onPick={handleRate} disabled={pending !== null} />
					<p className="text-xs text-rankd-faint">
						{myRating === null ? "Pick a score from 0 to 10." : "Tap a different score to update your rating."}
					</p>
				</div>
			)}
		</>
	);
}
