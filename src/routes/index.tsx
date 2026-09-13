import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

import { Welcome } from "../welcome/welcome";

const getCloudflareMessage = createServerFn({ method: "GET" }).handler(
	async () => {
		const { env } = await import("cloudflare:workers");
		return env.VALUE_FROM_CLOUDFLARE;
	},
);

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [
			{ title: "New TanStack Start App" },
			{ name: "description", content: "Welcome to TanStack Start!" },
		],
	}),
	loader: () => getCloudflareMessage(),
	component: Home,
});

function Home() {
	const message = Route.useLoaderData();
	return <Welcome message={message} />;
}
