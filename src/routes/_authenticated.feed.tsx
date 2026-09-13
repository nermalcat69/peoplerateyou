import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { addCommentFn, listCommentsFn, listFeedFn, ratePhotoFn, uploadPhotoFn } from "../server/photos";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/_authenticated/feed")({
	loader: () => listFeedFn(),
	component: FeedPage,
});

type FeedItem = Awaited<ReturnType<typeof listFeedFn>>[number];

function FeedPage() {
	const items = Route.useLoaderData();
	const router = useRouter();
	const upload = useServerFn(uploadPhotoFn);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);

	async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = e.currentTarget;
		const formData = new FormData(form);
		if (!(formData.get("file") as File)?.size) return;

		setUploading(true);
		setUploadError(null);
		try {
			await upload({ data: formData });
			form.reset();
			await router.invalidate();
		} catch (err) {
			setUploadError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setUploading(false);
		}
	}

	return (
		<div className="max-w-2xl mx-auto px-4">
			<header className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
				<span className="font-semibold">PeopleRateYou</span>
				<div className="flex items-center gap-3 text-sm">
					<Link to="/profile" className="text-blue-700 dark:text-blue-500 hover:underline">
						Dashboard
					</Link>
					<button
						type="button"
						className="text-blue-700 dark:text-blue-500 hover:underline"
						onClick={async () => {
							await authClient.signOut();
							await router.invalidate();
							await router.navigate({ to: "/login" });
						}}
					>
						Log out
					</button>
				</div>
			</header>

			<div className="py-6 space-y-8">
				<form
					onSubmit={handleUpload}
					className="flex flex-col gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 p-4"
				>
					<label className="text-sm font-medium">Upload a photo</label>
					<input type="file" name="file" accept="image/png,image/jpeg" required />
					{uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
					<button
						type="submit"
						disabled={uploading}
						className="self-start rounded-full bg-blue-700 text-white px-4 py-2 text-sm disabled:opacity-50"
					>
						{uploading ? "Uploading…" : "Upload"}
					</button>
				</form>

				{items.length === 0 && (
					<p className="text-center text-gray-500">No photos to rate yet.</p>
				)}

				<div className="space-y-10">
					{items.map((item) => (
						<PhotoCard key={item.id} item={item} />
					))}
				</div>
			</div>
		</div>
	);
}

function PhotoCard({ item }: { item: FeedItem }) {
	const router = useRouter();
	const rate = useServerFn(ratePhotoFn);
	const [myScore, setMyScore] = useState(item.myScore);
	const [rating, setRating] = useState(false);

	async function handleRate(score: number) {
		setRating(true);
		try {
			await rate({ data: { photoId: item.id, score } });
			setMyScore(score);
			await router.invalidate();
		} finally {
			setRating(false);
		}
	}

	return (
		<div className="space-y-3">
			<img
				src={item.imageUrl}
				alt={`Photo by ${item.ownerDisplayName}`}
				className="w-full rounded-2xl object-cover"
			/>
			<div className="flex items-center justify-between text-sm text-gray-500">
				<span>{item.ownerDisplayName}</span>
				<span>
					{item.avgScore !== null ? item.avgScore.toFixed(1) : "—"} avg · {item.ratingCount}{" "}
					ratings
				</span>
			</div>
			<div className="flex flex-wrap gap-1">
				{Array.from({ length: 11 }, (_, score) => (
					<button
						key={score}
						type="button"
						disabled={rating}
						onClick={() => handleRate(score)}
						className={`h-8 w-8 rounded-full text-sm border ${
							myScore === score
								? "bg-blue-700 text-white border-blue-700"
								: "border-gray-300 dark:border-gray-700"
						}`}
					>
						{score}
					</button>
				))}
			</div>
			<Comments photoId={item.id} commentCount={item.commentCount} />
		</div>
	);
}

function Comments({ photoId, commentCount }: { photoId: string; commentCount: number }) {
	const addComment = useServerFn(addCommentFn);
	const listComments = useServerFn(listCommentsFn);
	const [open, setOpen] = useState(false);
	const [comments, setComments] = useState<Awaited<ReturnType<typeof listCommentsFn>> | null>(null);
	const [text, setText] = useState("");
	const [submitting, setSubmitting] = useState(false);

	async function toggleOpen() {
		if (!open && !comments) {
			setComments(await listComments({ data: { photoId } }));
		}
		setOpen((v) => !v);
	}

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!text.trim()) return;
		setSubmitting(true);
		try {
			const comment = await addComment({ data: { photoId, body: text } });
			setComments((prev) => [...(prev ?? []), comment]);
			setText("");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="text-sm">
			<button type="button" className="text-blue-700 dark:text-blue-500 hover:underline" onClick={toggleOpen}>
				{open ? "Hide comments" : `View comments (${commentCount})`}
			</button>
			{open && (
				<div className="mt-2 space-y-2">
					{comments?.map((c) => (
						<p key={c.id}>
							<span className="font-medium">{c.authorDisplayName}: </span>
							{c.body}
						</p>
					))}
					<form onSubmit={handleSubmit} className="flex gap-2">
						<input
							value={text}
							onChange={(e) => setText(e.target.value)}
							placeholder="Add a comment"
							maxLength={500}
							className="flex-1 rounded border border-gray-300 dark:border-gray-700 px-2 py-1 bg-transparent"
						/>
						<button type="submit" disabled={submitting} className="text-blue-700 dark:text-blue-500">
							Post
						</button>
					</form>
				</div>
			)}
		</div>
	);
}
