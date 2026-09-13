import { createMiddleware, createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { getAuth } from "./auth-instance";

export interface SessionUser {
	id: string;
	email: string;
	name: string;
}

export const getSessionUser = createServerOnlyFn(async (): Promise<SessionUser | null> => {
	const auth = await getAuth();
	const session = await auth.api.getSession({ headers: getRequest().headers });
	if (!session) return null;
	return { id: session.user.id, email: session.user.email, name: session.user.name };
});

export const authMiddleware = createMiddleware().server(async ({ next }) => {
	const user = await getSessionUser();
	if (!user) throw new Error("UNAUTHORIZED");
	return next({ context: { user } });
});

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getSessionUser();
});
