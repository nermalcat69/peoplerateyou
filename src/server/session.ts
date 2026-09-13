import { createServerOnlyFn } from "@tanstack/react-start";
import {
	getRequestHeader,
	setResponseHeader,
} from "@tanstack/react-start/server";

const SESSION_COOKIE = "__Host-session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const setSessionCookie = createServerOnlyFn((token: string) => {
	setResponseHeader(
		"Set-Cookie",
		[
			`${SESSION_COOKIE}=${token}`,
			"HttpOnly",
			"Secure",
			"SameSite=Lax",
			"Path=/",
			`Max-Age=${SESSION_TTL_SECONDS}`,
		].join("; "),
	);
});

export const clearSessionCookie = createServerOnlyFn(() => {
	setResponseHeader(
		"Set-Cookie",
		`${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
	);
});

export const readSessionToken = createServerOnlyFn((): string | null => {
	const header = getRequestHeader("cookie");
	if (!header) return null;
	for (const part of header.split(/;\s*/)) {
		const eq = part.indexOf("=");
		if (eq === -1) continue;
		if (part.slice(0, eq) === SESSION_COOKIE) return part.slice(eq + 1);
	}
	return null;
});

export const getClientIp = createServerOnlyFn((): string => {
	return getRequestHeader("cf-connecting-ip") ?? "unknown";
});

export { SESSION_TTL_SECONDS };
