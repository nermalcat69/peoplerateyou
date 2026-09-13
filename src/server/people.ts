import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "./auth";
import { cfEnv } from "./cf-env";
import { slugify } from "../lib/avatar";

interface UserRow {
	id: string;
	name: string;
	image: string | null;
}

interface ProfileRow {
	username: string;
	bio: string;
	location: string;
}

async function ensureProfile(env: Env, userId: string, name: string): Promise<ProfileRow> {
	const existing = await env.DB.prepare("SELECT username, bio, location FROM profiles WHERE user_id = ?")
		.bind(userId)
		.first<ProfileRow>();
	if (existing) return existing;

	const base = slugify(name);
	const username = `${base}-${userId.slice(0, 6).toLowerCase()}`;
	try {
		await env.DB.prepare("INSERT INTO profiles (user_id, username) VALUES (?, ?)").bind(userId, username).run();
	} catch {
		// Lost a race with another request creating the same row; fall through to re-read.
	}
	const row = await env.DB.prepare("SELECT username, bio, location FROM profiles WHERE user_id = ?")
		.bind(userId)
		.first<ProfileRow>();
	return row ?? { username, bio: "", location: "" };
}

function computeStreak(days: string[]): number {
	if (days.length === 0) return 0;
	const todayUtc = new Date().toISOString().slice(0, 10);
	const oneDayMs = 24 * 60 * 60 * 1000;
	const mostRecent = new Date(`${days[0]}T00:00:00Z`).getTime();
	const gapFromToday = Math.round((new Date(`${todayUtc}T00:00:00Z`).getTime() - mostRecent) / oneDayMs);
	if (gapFromToday > 1) return 0;

	let streak = 1;
	for (let i = 1; i < days.length; i++) {
		const prev = new Date(`${days[i - 1]}T00:00:00Z`).getTime();
		const cur = new Date(`${days[i]}T00:00:00Z`).getTime();
		if (Math.round((prev - cur) / oneDayMs) === 1) streak++;
		else break;
	}
	return streak;
}

export interface RatedPersonRow {
	id: string;
	name: string;
	image: string | null;
	username: string;
	score: number;
	createdAt: string;
}

export const getSidebarInfoFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const env = await cfEnv();
		const user = await env.DB.prepare('SELECT id, name, image FROM "user" WHERE id = ?')
			.bind(context.user.id)
			.first<UserRow>();
		if (!user) throw new Error("User not found");
		const profile = await ensureProfile(env, user.id, user.name);
		return { id: user.id, name: user.name, image: user.image, username: profile.username };
	});

export const getDashboardFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const env = await cfEnv();
		const userId = context.user.id;

		const user = await env.DB.prepare('SELECT id, name, image, createdAt as joinedAt FROM "user" WHERE id = ?')
			.bind(userId)
			.first<UserRow & { joinedAt: string }>();
		if (!user) throw new Error("User not found");

		const profile = await ensureProfile(env, userId, user.name);

		const [peopleRated, avgRow, thisMonth, views, viewsWeek, streakRows, recent] = await Promise.all([
			env.DB.prepare("SELECT COUNT(*) as c FROM person_ratings WHERE rater_id = ?").bind(userId).first<{ c: number }>(),
			env.DB.prepare("SELECT AVG(score) as avg FROM person_ratings WHERE rater_id = ?")
				.bind(userId)
				.first<{ avg: number | null }>(),
			env.DB.prepare("SELECT COUNT(*) as c FROM person_ratings WHERE rater_id = ? AND created_at >= strftime('%Y-%m-01', 'now')")
				.bind(userId)
				.first<{ c: number }>(),
			env.DB.prepare("SELECT COUNT(*) as c FROM profile_views WHERE viewed_id = ?").bind(userId).first<{ c: number }>(),
			env.DB.prepare("SELECT COUNT(*) as c FROM profile_views WHERE viewed_id = ? AND created_at >= datetime('now', '-7 days')")
				.bind(userId)
				.first<{ c: number }>(),
			env.DB.prepare(
				"SELECT DISTINCT date(created_at) as d FROM person_ratings WHERE rater_id = ? ORDER BY d DESC LIMIT 60",
			)
				.bind(userId)
				.all<{ d: string }>(),
			env.DB.prepare(
				`SELECT u.id as id, u.name as name, u.image as image, p.username as username, pr.score as score, pr.created_at as createdAt
				 FROM person_ratings pr
				 JOIN "user" u ON u.id = pr.ratee_id
				 LEFT JOIN profiles p ON p.user_id = u.id
				 WHERE pr.rater_id = ?
				 ORDER BY pr.created_at DESC
				 LIMIT 4`,
			)
				.bind(userId)
				.all<RatedPersonRow>(),
		]);

		const peopleRatedCount = peopleRated?.c ?? 0;
		const hasBio = profile.bio.trim().length > 0;
		const hasLocation = profile.location.trim().length > 0;
		const hasImage = !!user.image;
		const completionChecks = [hasBio, hasLocation, hasImage, peopleRatedCount > 0];
		const profileCompletion = Math.round(
			(completionChecks.filter(Boolean).length / completionChecks.length) * 100,
		);

		return {
			id: user.id,
			name: user.name,
			image: user.image,
			username: profile.username,
			bio: profile.bio,
			location: profile.location,
			joinedAt: user.joinedAt,
			profileCompletion,
			stats: {
				peopleRated: peopleRatedCount,
				ratingsThisMonth: thisMonth?.c ?? 0,
				avgRatingGiven: avgRow?.avg ?? null,
				profileViews: views?.c ?? 0,
				profileViewsThisWeek: viewsWeek?.c ?? 0,
			},
			streak: computeStreak(streakRows.results.map((r) => r.d)),
			recentRatings: recent.results,
		};
	});

function validateProfileUpdate(data: unknown) {
	if (typeof data !== "object" || data === null) throw new Error("Invalid input");
	const { bio, location } = data as Record<string, unknown>;
	if (typeof bio !== "string" || bio.length > 280) throw new Error("Bio must be 280 characters or fewer");
	if (typeof location !== "string" || location.length > 80) throw new Error("Location must be 80 characters or fewer");
	return { bio: bio.trim(), location: location.trim() };
}

export const updateProfileFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validateProfileUpdate)
	.handler(async ({ data, context }) => {
		const env = await cfEnv();
		await ensureProfile(env, context.user.id, context.user.name);
		await env.DB.prepare(
			"UPDATE profiles SET bio = ?, location = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
		)
			.bind(data.bio, data.location, context.user.id)
			.run();
		return { success: true };
	});

export const listPeopleRatedFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const env = await cfEnv();
		const { results } = await env.DB.prepare(
			`SELECT u.id as id, u.name as name, u.image as image, p.username as username, pr.score as score, pr.created_at as createdAt
			 FROM person_ratings pr
			 JOIN "user" u ON u.id = pr.ratee_id
			 LEFT JOIN profiles p ON p.user_id = u.id
			 WHERE pr.rater_id = ?
			 ORDER BY pr.created_at DESC
			 LIMIT 100`,
		)
			.bind(context.user.id)
			.all<RatedPersonRow>();
		return results;
	});

const DISTRIBUTION_BUCKETS = ["9-10", "7-8", "5-6", "3-4", "0-2"] as const;

export const getRatingsPageFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const env = await cfEnv();
		const userId = context.user.id;

		const [totals, thisMonth, distribution, recent] = await Promise.all([
			env.DB.prepare("SELECT COUNT(*) as c, AVG(score) as avg, MAX(score) as max FROM person_ratings WHERE rater_id = ?")
				.bind(userId)
				.first<{ c: number; avg: number | null; max: number | null }>(),
			env.DB.prepare("SELECT COUNT(*) as c FROM person_ratings WHERE rater_id = ? AND created_at >= strftime('%Y-%m-01', 'now')")
				.bind(userId)
				.first<{ c: number }>(),
			env.DB.prepare(
				`SELECT
					 CASE WHEN score >= 9 THEN '9-10' WHEN score >= 7 THEN '7-8' WHEN score >= 5 THEN '5-6'
						  WHEN score >= 3 THEN '3-4' ELSE '0-2' END as bucket,
					 COUNT(*) as count
				 FROM person_ratings WHERE rater_id = ? GROUP BY bucket`,
			)
				.bind(userId)
				.all<{ bucket: string; count: number }>(),
			env.DB.prepare(
				`SELECT u.id as id, u.name as name, u.image as image, p.username as username, pr.score as score, pr.created_at as createdAt
				 FROM person_ratings pr
				 JOIN "user" u ON u.id = pr.ratee_id
				 LEFT JOIN profiles p ON p.user_id = u.id
				 WHERE pr.rater_id = ?
				 ORDER BY pr.created_at DESC
				 LIMIT 8`,
			)
				.bind(userId)
				.all<RatedPersonRow>(),
		]);

		const counts = new Map(distribution.results.map((r) => [r.bucket, r.count]));
		const maxCount = Math.max(1, ...DISTRIBUTION_BUCKETS.map((b) => counts.get(b) ?? 0));

		return {
			totalPeopleRated: totals?.c ?? 0,
			averageRatingGiven: totals?.avg ?? null,
			highestRatingGiven: totals?.max ?? null,
			ratingsThisMonth: thisMonth?.c ?? 0,
			distribution: DISTRIBUTION_BUCKETS.map((bucket) => ({
				bucket,
				count: counts.get(bucket) ?? 0,
				pct: Math.round(((counts.get(bucket) ?? 0) / maxCount) * 100),
			})),
			recentActivity: recent.results,
		};
	});

export interface DiscoverPersonRow {
	id: string;
	name: string;
	image: string | null;
	username: string;
	bio: string;
	location: string;
}

export const listDiscoverFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const env = await cfEnv();
		const userId = context.user.id;

		const { results: users } = await env.DB.prepare(
			`SELECT id, name, image FROM "user"
			 WHERE id != ? AND id NOT IN (SELECT ratee_id FROM person_ratings WHERE rater_id = ?)
			 ORDER BY createdAt DESC
			 LIMIT 20`,
		)
			.bind(userId, userId)
			.all<UserRow>();

		const people = await Promise.all(
			users.map(async (u) => {
				const profile = await ensureProfile(env, u.id, u.name);
				return { ...u, ...profile } satisfies DiscoverPersonRow;
			}),
		);
		return people;
	});

function validatePersonId(data: unknown) {
	if (typeof data !== "object" || data === null) throw new Error("Invalid input");
	const { userId } = data as Record<string, unknown>;
	if (typeof userId !== "string" || !userId) throw new Error("Invalid user");
	return { userId };
}

export const getPersonFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(validatePersonId)
	.handler(async ({ data, context }) => {
		const env = await cfEnv();
		const viewerId = context.user.id;

		const user = await env.DB.prepare('SELECT id, name, image, createdAt as joinedAt FROM "user" WHERE id = ?')
			.bind(data.userId)
			.first<UserRow & { joinedAt: string }>();
		if (!user) throw new Error("Person not found");

		const profile = await ensureProfile(env, user.id, user.name);

		const [received, myRating] = await Promise.all([
			env.DB.prepare("SELECT COUNT(*) as c, AVG(score) as avg FROM person_ratings WHERE ratee_id = ?")
				.bind(user.id)
				.first<{ c: number; avg: number | null }>(),
			env.DB.prepare("SELECT score FROM person_ratings WHERE rater_id = ? AND ratee_id = ?")
				.bind(viewerId, user.id)
				.first<{ score: number }>(),
		]);

		if (viewerId !== user.id) {
			await env.DB.prepare("INSERT INTO profile_views (viewer_id, viewed_id) VALUES (?, ?)")
				.bind(viewerId, user.id)
				.run();
		}

		return {
			id: user.id,
			name: user.name,
			image: user.image,
			username: profile.username,
			bio: profile.bio,
			location: profile.location,
			joinedAt: user.joinedAt,
			timesRated: received?.c ?? 0,
			avgRatingReceived: received?.avg ?? null,
			myRating: myRating?.score ?? null,
			isSelf: viewerId === user.id,
		};
	});

function validateRating(data: unknown) {
	if (typeof data !== "object" || data === null) throw new Error("Invalid input");
	const { userId, score } = data as Record<string, unknown>;
	if (typeof userId !== "string" || !userId) throw new Error("Invalid user");
	if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 10)
		throw new Error("Score must be an integer between 0 and 10");
	return { userId, score };
}

export const rateUserFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validateRating)
	.handler(async ({ data, context }) => {
		if (data.userId === context.user.id) throw new Error("You can't rate yourself");

		const env = await cfEnv();
		const target = await env.DB.prepare('SELECT id FROM "user" WHERE id = ?').bind(data.userId).first();
		if (!target) throw new Error("Person not found");

		await env.DB.prepare(
			`INSERT INTO person_ratings (rater_id, ratee_id, score) VALUES (?, ?, ?)
			 ON CONFLICT (rater_id, ratee_id) DO UPDATE SET score = excluded.score, created_at = CURRENT_TIMESTAMP`,
		)
			.bind(context.user.id, data.userId, data.score)
			.run();

		return { success: true };
	});
