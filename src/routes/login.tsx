import { useState } from "react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { getCurrentUserFn, loginFn, signupFn } from "../server/auth";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		const user = await getCurrentUserFn();
		if (user) throw redirect({ to: "/feed" });
	},
	component: LoginPage,
});

function LoginPage() {
	const router = useRouter();
	const login = useServerFn(loginFn);
	const signup = useServerFn(signupFn);
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

		try {
			if (mode === "login") {
				await login({ data: { email, password } });
			} else {
				await signup({ data: { email, password, displayName } });
			}
			await router.invalidate();
			await router.navigate({ to: "/feed" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setSubmitting(false);
		}
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
