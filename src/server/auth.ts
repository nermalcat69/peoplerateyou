import { createMiddleware, createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { getAuth } from "./auth-instance";
import { detectHijack, revokeAndLog, type RevokeReason } from "./session-security";

export interface SessionUser {
	id: string;
	email: string;
	name: string;
}

interface SessionCheck {
	user: SessionUser | null;
	// Set when this exact call is the one that caught and revoked a hijacked
	// session, so the UI can explain why it just got signed out instead of
	// looking like a silent, unexplained logout.
	revokedReason: RevokeReason | null;
}

const checkSession = createServerOnlyFn(async (): Promise<SessionCheck> => {
	const auth = await getAuth();
	const request = getRequest();
	const result = await auth.api.getSession({ headers: request.headers });
	if (!result) return { user: null, revokedReason: null };

	const { session, user } = result;
	const reason = await detectHijack(session, request);
	if (reason) {
		await revokeAndLog(session, request, reason);
		return { user: null, revokedReason: reason };
	}

	return { user: { id: user.id, email: user.email, name: user.name }, revokedReason: null };
});

export const getSessionUser = createServerOnlyFn(async (): Promise<SessionUser | null> => {
	return (await checkSession()).user;
});

export const authMiddleware = createMiddleware().server(async ({ next }) => {
	const user = await getSessionUser();
	if (!user) throw new Error("UNAUTHORIZED");
	return next({ context: { user } });
});

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return checkSession();
});
