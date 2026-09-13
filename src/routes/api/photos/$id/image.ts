import { createFileRoute } from "@tanstack/react-router";

import { cfEnv } from "../../../../server/cf-env";
import { timingSafeEqual } from "../../../../server/crypto";
import { signPhotoToken } from "../../../../server/image-url";

export const Route = createFileRoute("/api/photos/$id/image")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const url = new URL(request.url);
				const exp = Number(url.searchParams.get("exp"));
				const sig = url.searchParams.get("sig") ?? "";

				if (!exp || !sig || Date.now() > exp) {
					return new Response("Link expired", { status: 403 });
				}

				const expected = await signPhotoToken(params.id, exp);
				if (!timingSafeEqual(sig, expected)) {
					return new Response("Invalid signature", { status: 403 });
				}

				const env = await cfEnv();
				const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
				const { success } = await env.VIEW_RATE_LIMITER.limit({ key: ip });
				if (!success) return new Response("Too many requests", { status: 429 });

				const photo = await env.DB.prepare(
					"SELECT r2_key FROM photos WHERE id = ? AND status = 'active'",
				)
					.bind(params.id)
					.first<{ r2_key: string }>();
				if (!photo) return new Response("Not found", { status: 404 });

				const object = await env.PHOTOS.get(photo.r2_key);
				if (!object) return new Response("Not found", { status: 404 });

				return new Response(object.body, {
					headers: {
						"Content-Type": "image/webp",
						"Cache-Control": "private, max-age=30",
						"X-Content-Type-Options": "nosniff",
					},
				});
			},
		},
	},
});
