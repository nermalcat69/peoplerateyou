import { useState } from "react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";

import { getCurrentUserFn } from "../server/auth";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		const user = await getCurrentUserFn();
		if (user) throw redirect({ to: "/feed" });
	},
	component: LoginPage,
});

function LoginPage() {
	const router = useRouter();
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
		await router.navigate({ to: "/feed" });
	}

	return (
		<div className="max-w-sm mx-auto px-4 py-16 space-y-6">
			<h1 className="text-xl font-semibold text-center">PeopleRateYou</h1>
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
		</div>
	);
}
