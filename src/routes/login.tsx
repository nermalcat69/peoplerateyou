import { useState } from "react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";

import { getCurrentUserFn } from "../server/auth";
import { authClient } from "../lib/auth-client";
import { accentFor, initials } from "../lib/avatar";
import { IconMapPin } from "../components/icons";

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>): { security?: string } => ({
		...(typeof search.security === "string" ? { security: search.security } : {}),
	}),
	beforeLoad: async () => {
		const { user } = await getCurrentUserFn();
		if (user) throw redirect({ to: "/profile" });
	},
	component: LoginPage,
});

const DEMO_PEOPLE = [
	{ id: "demo-1", name: "Maya Chen", username: "mayachen", bio: "Product designer, plant parent, terrible at karaoke.", location: "Austin, TX" },
	{ id: "demo-2", name: "Jordan Blake", username: "jblake", bio: "Runs 5ks for fun, cooks for stress relief.", location: "Denver, CO" },
	{ id: "demo-3", name: "Priya Nair", username: "priyan", bio: "Backend engineer who tells great campfire stories.", location: "Seattle, WA" },
	{ id: "demo-4", name: "Sam Ortega", username: "samortega", bio: "Amateur photographer, professional dog walker.", location: "Chicago, IL" },
	{ id: "demo-5", name: "Ava Thompson", username: "avat", bio: "Loud laugh, quiet mornings, loyal friend.", location: "Portland, OR" },
] as const;

const ACCENT_BG = {
	"rankd-blue": "bg-rankd-blue",
	"rankd-purple": "bg-rankd-purple",
	"rankd-yellow": "bg-rankd-yellow",
	"rankd-pink": "bg-rankd-pink",
} as const;

function DemoPreview() {
	const [index, setIndex] = useState(0);
	const [score, setScore] = useState(5);
	const person = DEMO_PEOPLE[index]!;

	function next() {
		setIndex((i) => (i + 1) % DEMO_PEOPLE.length);
		setScore(5);
	}

	return (
		<div className="mx-auto w-full max-w-sm flex flex-col gap-3">
			<p className="text-center text-xs font-bold text-gray-500 dark:text-gray-400">
				Try it out — here's what rating people looks like
			</p>
			<div className="relative rounded-3xl overflow-hidden bg-rankd-elev border border-rankd-border aspect-3/4 shrink-0">
				<div className={`absolute inset-0 flex items-center justify-center ${ACCENT_BG[accentFor(person.id)]}`}>
					<span className="font-display font-extrabold uppercase text-rankd-ink text-8xl">{initials(person.name)}</span>
				</div>
				<div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/40 to-transparent p-5 pt-16">
					<div className="text-2xl font-display font-extrabold text-white leading-tight">{person.name}</div>
					<div className="text-sm text-white/80 mt-1 flex items-center gap-1.5">
						@{person.username}
						<span>·</span>
						<IconMapPin size={13} />
						{person.location}
					</div>
					<p className="text-sm text-white/90 mt-2 line-clamp-2">{person.bio}</p>
				</div>
			</div>
			<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-4 flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<div className="text-sm font-bold text-rankd-faint">Your rating</div>
					<div className="font-display text-2xl font-extrabold text-rankd-accent">{score.toFixed(1)}</div>
				</div>
				<input
					type="range"
					min={0}
					max={10}
					step={1}
					value={score}
					onChange={(e) => setScore(Number(e.target.value))}
					className="w-full accent-rankd-accent h-2"
				/>
				<button
					type="button"
					onClick={next}
					className="w-full py-2.5 rounded-lg text-sm font-bold bg-rankd-accent text-white"
				>
					Rated {score.toFixed(1)} · Next Profile
				</button>
			</div>
			<p className="text-center text-xs text-gray-500 dark:text-gray-400">Sign up to rate real people and get rated yourself.</p>
		</div>
	);
}

const SECURITY_MESSAGES: Record<string, string> = {
	location_mismatch:
		"For your safety, you were signed out because this session was suddenly used from a different region. Please log in again.",
	fingerprint_mismatch:
		"For your safety, you were signed out because this session was suddenly used from a different device. Please log in again.",
};

function LoginPage() {
	const router = useRouter();
	const { security } = Route.useSearch();
	const [mode, setMode] = useState<"login" | "signup">("login");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		const formData = new FormData(e.currentTarget);
		const email = String(formData.get("email") ?? "");
		const password = String(formData.get("password") ?? "");
		const displayName = String(formData.get("displayName") ?? "");

		const { error: authError } =
			mode === "login"
				? await authClient.signIn.email({ email, password })
				: await authClient.signUp.email({ email, password, name: displayName });

		setSubmitting(false);
		if (authError) {
			setError(authError.message ?? "Something went wrong");
			return;
		}

		await router.invalidate();
		await router.navigate({ to: "/profile" });
	}

	return (
		<div className="max-w-sm mx-auto px-4 py-16 space-y-6">
			<h1 className="text-xl font-semibold text-center">PeopleRateYou</h1>
			{security && (
				<p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 dark:text-amber-200 dark:bg-amber-950 dark:border-amber-900">
					{SECURITY_MESSAGES[security] ?? SECURITY_MESSAGES.location_mismatch}
				</p>
			)}
			<form onSubmit={handleSubmit} className="space-y-3">
				{mode === "signup" && (
					<input
						name="displayName"
						placeholder="Display name"
						required
						className="w-full rounded border border-gray-300 dark:border-gray-700 px-3 py-2 bg-transparent"
					/>
				)}
				<input
					name="email"
					type="email"
					placeholder="Email"
					required
					className="w-full rounded border border-gray-300 dark:border-gray-700 px-3 py-2 bg-transparent"
				/>
				<input
					name="password"
					type="password"
					placeholder="Password"
					minLength={8}
					required
					className="w-full rounded border border-gray-300 dark:border-gray-700 px-3 py-2 bg-transparent"
				/>
				{error && <p className="text-sm text-red-600">{error}</p>}
				<button
					type="submit"
					disabled={submitting}
					className="w-full rounded-full bg-blue-700 text-white px-4 py-2 text-sm disabled:opacity-50"
				>
					{mode === "login" ? "Log in" : "Sign up"}
				</button>
			</form>
			<button
				type="button"
				className="w-full text-sm text-blue-700 dark:text-blue-500 hover:underline"
				onClick={() => setMode(mode === "login" ? "signup" : "login")}
			>
				{mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
			</button>
			<div className="pt-6 border-t border-gray-200 dark:border-gray-800">
				<DemoPreview />
			</div>
		</div>
	);
}
