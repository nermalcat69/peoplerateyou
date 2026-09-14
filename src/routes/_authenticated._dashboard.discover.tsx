import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { listDiscoverFn, rateUserFn } from "../server/people";
import { accentFor, initials } from "../lib/avatar";
import { IconChevronLeft, IconChevronRight, IconMapPin } from "../components/icons";

export const Route = createFileRoute("/_authenticated/_dashboard/discover")({
	loader: () => listDiscoverFn(),
	component: DiscoverPage,
});

const ACCENT_BG = {
	"rankd-blue": "bg-rankd-blue",
	"rankd-purple": "bg-rankd-purple",
	"rankd-yellow": "bg-rankd-yellow",
	"rankd-pink": "bg-rankd-pink",
} as const;

function DiscoverPage() {
	const people = Route.useLoaderData();
	const rateUser = useServerFn(rateUserFn);
	const [index, setIndex] = useState(0);
	const [score, setScore] = useState(5);
	const [submitting, setSubmitting] = useState(false);
	const [justRated, setJustRated] = useState<number | null>(null);

	const person = people[index];

	function goNext() {
		setIndex((i) => Math.min(i + 1, people.length));
		setScore(5);
		setJustRated(null);
	}

	function goPrev() {
		setIndex((i) => Math.max(i - 1, 0));
		setScore(5);
		setJustRated(null);
	}

	async function handleRate() {
		if (!person) return;
		setSubmitting(true);
		try {
			await rateUser({ data: { userId: person.id, score } });
			setJustRated(score);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<>
			<div className="font-display text-3xl font-extrabold">Discover</div>

			{!person ? (
				<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-8 text-sm text-rankd-faint text-center">
					You've rated everyone on the platform so far — check back later for new profiles.
				</div>
			) : (
				<div className="mx-auto w-full max-w-sm flex flex-col gap-5">
					<div className="flex items-center justify-between">
						<button
							type="button"
							onClick={goPrev}
							disabled={index === 0}
							className="size-9 rounded-full border border-rankd-border flex items-center justify-center disabled:opacity-30"
							aria-label="Previous"
						>
							<IconChevronLeft />
						</button>
						<div className="text-xs font-bold text-rankd-faint">
							{index + 1} of {people.length}
						</div>
						<button
							type="button"
							onClick={goNext}
							disabled={index === people.length - 1}
							className="size-9 rounded-full border border-rankd-border flex items-center justify-center disabled:opacity-30"
							aria-label="Next"
						>
							<IconChevronRight />
						</button>
					</div>

					<div className="relative rounded-3xl overflow-hidden bg-rankd-elev border border-rankd-border aspect-3/4 shrink-0">
						{person.image ? (
							<img src={person.image} alt={person.name} className="absolute inset-0 size-full object-cover" />
						) : (
							<div
								className={`absolute inset-0 flex items-center justify-center ${ACCENT_BG[accentFor(person.id)]}`}
							>
								<span className="font-display font-extrabold uppercase text-rankd-ink text-8xl">
									{initials(person.name)}
								</span>
							</div>
						)}
						<div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/40 to-transparent p-5 pt-16">
							<div className="text-2xl font-display font-extrabold text-white leading-tight">{person.name}</div>
							<div className="text-sm text-white/80 mt-1 flex items-center gap-1.5">
								@{person.username}
								{person.location && (
									<>
										<span>·</span>
										<IconMapPin size={13} />
										{person.location}
									</>
								)}
							</div>
							{person.bio && <p className="text-sm text-white/90 mt-2 line-clamp-2">{person.bio}</p>}
						</div>
					</div>

					<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-5 flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<div className="text-sm font-bold text-rankd-faint">Your rating</div>
							<div className="font-display text-3xl font-extrabold text-rankd-accent">{score.toFixed(1)}</div>
						</div>
						<input
							type="range"
							min={0}
							max={10}
							step={1}
							value={score}
							onChange={(e) => {
								setScore(Number(e.target.value));
								setJustRated(null);
							}}
							disabled={submitting}
							className="w-full accent-rankd-accent h-2"
						/>
						<div className="flex items-center justify-between text-[11px] font-bold text-rankd-faint px-0.5">
							<span>0</span>
							<span>5</span>
							<span>10</span>
						</div>

						{justRated !== null ? (
							<button
								type="button"
								onClick={goNext}
								className="w-full py-3 rounded-lg text-sm font-bold bg-rankd-accent text-white"
							>
								Rated {justRated.toFixed(1)} · Next Profile
							</button>
						) : (
							<div className="flex gap-2.5">
								<button
									type="button"
									onClick={goNext}
									disabled={submitting}
									className="flex-1 py-3 rounded-lg text-sm font-bold border border-rankd-border disabled:opacity-50"
								>
									Skip
								</button>
								<button
									type="button"
									onClick={handleRate}
									disabled={submitting}
									className="flex-1 py-3 rounded-lg text-sm font-bold bg-rankd-accent text-white disabled:opacity-50"
								>
									{submitting ? "Submitting…" : "Submit Rating"}
								</button>
							</div>
						)}

						<Link
							to="/people/$userId"
							params={{ userId: person.id }}
							className="text-center text-xs font-bold text-rankd-faint hover:text-rankd-text"
						>
							View Full Profile
						</Link>
					</div>
				</div>
			)}
		</>
	);
}
