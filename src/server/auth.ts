import { createMiddleware, createServerFn } from "@tanstack/react-start";

import { cfEnv } from "./cf-env";
import { hashPassword, randomToken, verifyPassword } from "./crypto";
import {
	clearSessionCookie,
	getClientIp,
	readSessionToken,
	setSessionCookie,
	SESSION_TTL_SECONDS,
} from "./session";

export interface PublicUser {
	id: string;
	email: string;
	displayName: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignup(data: unknown) {
	if (typeof data !== "object" || data === null) throw new Error("Invalid input");
	const { email, password, displayName } = data as Record<string, unknown>;
	if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 255)
		throw new Error("Enter a valid email address");
	if (typeof password !== "string" || password.length < 8 || password.length > 100)
		throw new Error("Password must be 8-100 characters");
	if (
		typeof displayName !== "string" ||
		displayName.trim().length < 1 ||
		displayName.length > 40
	)
		throw new Error("Display name must be 1-40 characters");
	return { email: email.toLowerCase(), password, displayName: displayName.trim() };
}

function validateLogin(data: unknown) {
	if (typeof data !== "object" || data === null) throw new Error("Invalid input");
	const { email, password } = data as Record<string, unknown>;
	if (typeof email !== "string" || typeof password !== "string")
		throw new Error("Invalid input");
	return { email: email.toLowerCase(), password };
}

export async function getSessionUser(): Promise<PublicUser | null> {
	const token = readSessionToken();
	if (!token) return null;

	const env = await cfEnv();
	const row = await env.DB.prepare(
		`SELECT u.id as id, u.email as email, u.display_name as displayName
		 FROM sessions s JOIN users u ON u.id = s.user_id
		 WHERE s.token = ? AND s.expires_at > ?`,
	)
		.bind(token, Date.now())
		.first<PublicUser>();

	return row ?? null;
}

export const authMiddleware = createMiddleware().server(async ({ next }) => {
	const user = await getSessionUser();
	if (!user) throw new Error("UNAUTHORIZED");
	return next({ context: { user } });
});

export const signupFn = createServerFn({ method: "POST" })
	.validator(validateSignup)
	.handler(async ({ data }) => {
		const env = await cfEnv();
		const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
			.bind(data.email)
			.first();
		if (existing) throw new Error("An account with that email already exists");

		const { hash, salt } = await hashPassword(data.password);
		const userId = crypto.randomUUID();

		await env.DB.prepare(
			"INSERT INTO users (id, email, display_name, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)",
		)
			.bind(userId, data.email, data.displayName, hash, salt)
			.run();

		await createSessionForUser(userId);
		return { id: userId, email: data.email, displayName: data.displayName } satisfies PublicUser;
	});

export const loginFn = createServerFn({ method: "POST" })
	.validator(validateLogin)
	.handler(async ({ data }) => {
		const env = await cfEnv();
		const { success } = await env.AUTH_RATE_LIMITER.limit({ key: getClientIp() });
		if (!success) throw new Error("Too many login attempts. Try again in a minute.");

		const row = await env.DB.prepare(
			"SELECT id, email, display_name as displayName, password_hash, password_salt FROM users WHERE email = ?",
		)
			.bind(data.email)
			.first<PublicUser & { password_hash: string; password_salt: string }>();

		const valid =
			row && (await verifyPassword(data.password, row.password_salt, row.password_hash));
		if (!row || !valid) throw new Error("Invalid email or password");

		await createSessionForUser(row.id);
		return { id: row.id, email: row.email, displayName: row.displayName } satisfies PublicUser;
	});

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
	const token = readSessionToken();
	if (token) {
		const env = await cfEnv();
		await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
	}
	clearSessionCookie();
	return { success: true };
});

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getSessionUser();
});

async function createSessionForUser(userId: string) {
	const env = await cfEnv();
	const token = randomToken();
	const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
	await env.DB.prepare(
		"INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
	)
		.bind(token, userId, expiresAt)
		.run();
	setSessionCookie(token);
}
