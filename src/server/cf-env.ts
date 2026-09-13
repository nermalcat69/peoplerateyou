import { createServerOnlyFn } from "@tanstack/react-start";

export const cfEnv = createServerOnlyFn(async (): Promise<Env> => {
	return (await import("cloudflare:workers")).env;
});
