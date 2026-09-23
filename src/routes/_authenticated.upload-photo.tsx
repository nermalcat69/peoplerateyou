import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { computeFaceEmbedding } from "../lib/faceEmbedding";
import { detectLandmarksOnce } from "../lib/liveness";
import { getVerificationStatusFn, setReferencePhotoFn } from "../server/verification";

export const Route = createFileRoute("/_authenticated/upload-photo")({
	loader: () => getVerificationStatusFn(),
	component: UploadPhotoPage,
});

function UploadPhotoPage() {
	const status = Route.useLoaderData();
	const router = useRouter();
	const setReferencePhoto = useServerFn(setReferencePhotoFn);

	const [file, setFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		setError(null);
		const f = e.target.files?.[0] ?? null;
		setFile(f);
		setPreviewUrl(f ? URL.createObjectURL(f) : null);
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!file) return;
		setUploading(true);
		setError(null);
		try {
			const img = new Image();
			const loaded = new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error("Couldn't read that image"));
			});
			img.src = URL.createObjectURL(file);
			await loaded;

			const landmarks = await detectLandmarksOnce(img);
			if (!landmarks) throw new Error("We couldn't find a clear face in that photo — try a different one.");

			const embedding = await computeFaceEmbedding(img, landmarks);

			const formData = new FormData();
			formData.append("file", file);
			formData.append("embedding", JSON.stringify(embedding));
			await setReferencePhoto({ data: formData });

			await router.invalidate();
			await router.navigate({ to: "/verify-photo" });
		} catch (err) {
			console.error("upload-photo failed:", err);
			setError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setUploading(false);
		}
	}

	return (
		<div className="max-w-lg mx-auto px-4 py-10 flex flex-col gap-6">
			<div>
				<h1 className="font-display text-2xl font-extrabold">Add your verification photo</h1>
				<p className="text-sm text-rankd-faint mt-1.5">
					Upload a clear, front-facing photo of yourself. It's used only to confirm future verification
					selfies are really you — it's never shown to other users or posted to the feed.
				</p>
				{status.hasReferencePhoto && (
					<p className="text-sm text-rankd-faint mt-1.5">
						Uploading a new photo replaces your current one and clears any existing verified badge until
						you verify again.
					</p>
				)}
			</div>

			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<input type="file" accept="image/png,image/jpeg" onChange={handleFileChange} className="text-sm" />

				{previewUrl && (
					<img
						src={previewUrl}
						alt="Preview"
						className="w-48 h-48 rounded-2xl object-cover border border-rankd-border"
					/>
				)}

				{error && <p className="text-sm text-rankd-pink">{error}</p>}

				<button
					type="submit"
					disabled={!file || uploading}
					className="self-start px-5 py-3 rounded-lg text-sm font-bold bg-rankd-accent text-white disabled:opacity-50"
				>
					{uploading ? "Uploading…" : "Upload photo"}
				</button>
			</form>
		</div>
	);
}
