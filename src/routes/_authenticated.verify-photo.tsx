import { useEffect, useRef, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { computeFaceEmbedding } from "../lib/faceEmbedding";
import {
	detectLandmarksOnce,
	getFaceFraming,
	pickChallenge,
	runLivenessCapture,
	type ChallengeStep,
	type FaceFraming,
	type NormalizedPoint,
} from "../lib/liveness";
import { completeVerificationFn, getVerificationStatusFn } from "../server/verification";

export const Route = createFileRoute("/_authenticated/verify-photo")({
	loader: () => getVerificationStatusFn(),
	component: VerifyPhotoPage,
});

type Stage = "idle" | "camera" | "challenge" | "processing" | "done";

const DEFAULT_FRAMING: FaceFraming = { ok: false, message: "Center yourself in frame", faceHeightRatio: 0 };

function VerifyPhotoPage() {
	const status = Route.useLoaderData();
	const router = useRouter();
	const completeVerification = useServerFn(completeVerificationFn);

	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const framingLoopRef = useRef<number | null>(null);

	const [stage, setStage] = useState<Stage>("idle");
	const [error, setError] = useState<string | null>(null);
	const [challenge, setChallenge] = useState<ChallengeStep[]>([]);
	const [resultMessage, setResultMessage] = useState<string | null>(null);
	const [verified, setVerified] = useState(status.status === "verified");
	const [framing, setFraming] = useState<FaceFraming>(DEFAULT_FRAMING);

	useEffect(() => {
		return () => {
			stopCamera();
			stopFramingLoop();
		};
	}, []);

	function stopCamera() {
		streamRef.current?.getTracks().forEach((t) => t.stop());
		streamRef.current = null;
	}

	// Continuously tracks whether the person is well-framed (close enough,
	// centered) while the camera is on, so we only let them start the
	// challenge once they're at roughly "webcam distance" — where face
	// detection/matching reliability is far higher than for a small, distant
	// face in frame.
	function startFramingLoop() {
		let lastCheck = 0;
		async function tick(now: number) {
			if (!videoRef.current) return;
			if (now - lastCheck > 150) {
				lastCheck = now;
				const landmarks = await detectLandmarksOnce(videoRef.current);
				setFraming(getFaceFraming(landmarks));
			}
			framingLoopRef.current = requestAnimationFrame(tick);
		}
		framingLoopRef.current = requestAnimationFrame(tick);
	}

	function stopFramingLoop() {
		if (framingLoopRef.current !== null) {
			cancelAnimationFrame(framingLoopRef.current);
			framingLoopRef.current = null;
		}
	}

	async function startCamera() {
		setError(null);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
			streamRef.current = stream;
			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				await videoRef.current.play();
			}
			setStage("camera");
			startFramingLoop();
		} catch {
			setError("Camera access is required to verify your photo.");
		}
	}

	function handleCancel() {
		stopCamera();
		stopFramingLoop();
		setStage("idle");
		setError(null);
		router.navigate({ to: "/upload-photo" });
	}

	async function handleStartChallenge() {
		if (!framing.ok) return;
		setChallenge(pickChallenge());
		setStage("challenge");
		setError(null);
		stopFramingLoop();
		try {
			const video = videoRef.current!;
			const { samples } = await runLivenessCapture(video, { durationMs: 6000 });

			// Grab a fresh landmark read right after the challenge for the
			// embedding — the challenge loop tracks blink/yaw signals, not the
			// full landmark set needed for alignment.
			const landmarks: NormalizedPoint[] | null = await detectLandmarksOnce(video);
			if (!landmarks) throw new Error("Lost track of your face — try again");
			const embedding = await computeFaceEmbedding(video, landmarks);

			setStage("processing");
			const result = await completeVerification({ data: { embedding, samples } });

			stopCamera();
			await router.invalidate();
			setStage("done");
			setVerified(result.verified);
			setResultMessage(result.verified ? "You're verified! A badge now shows on your profile." : result.reason);
		} catch (err) {
			console.error("verify-photo failed:", err);
			setError(err instanceof Error ? err.message : "Verification failed, try again");
			setStage("camera");
			startFramingLoop();
		}
	}

	return (
		<div className="max-w-lg mx-auto px-4 py-10 flex flex-col gap-6">
			<div>
				<h1 className="font-display text-2xl font-extrabold">Verify it's you</h1>
				<p className="text-sm text-rankd-faint mt-1.5">
					Optional: follow the on-screen prompts (blink, turn your head) so we can confirm a live person,
					then match it to your reference photo, and get a verified badge on your profile.
				</p>
			</div>

			{error && <p className="text-sm text-rankd-pink">{error}</p>}

			{stage === "idle" && verified && (
				<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-5 text-sm flex flex-col gap-3">
					<p>You're verified. You can re-verify any time if your reference photo changes.</p>
					<a href="/profile" className="self-start text-rankd-accent font-bold">
						Back to profile
					</a>
				</div>
			)}

			{stage === "idle" && !verified && (
				<div className="flex items-center gap-4 flex-wrap">
					<button
						type="button"
						onClick={startCamera}
						className="px-5 py-3 rounded-lg text-sm font-bold bg-rankd-accent text-white"
					>
						Verify now
					</button>
					<a href="/upload-photo" className="text-sm font-bold text-rankd-faint hover:text-rankd-text">
						Change reference photo
					</a>
					<a href="/profile" className="text-sm font-bold text-rankd-faint hover:text-rankd-text">
						Skip for now
					</a>
				</div>
			)}

			<div className={stage === "camera" || stage === "challenge" ? "block" : "hidden"}>
				<video
					ref={videoRef}
					muted
					playsInline
					className="w-full rounded-2xl bg-black aspect-square object-cover"
				/>
				<p className={`mt-3 text-sm font-bold ${framing.ok ? "text-rankd-accent" : "text-rankd-pink"}`}>
					{stage === "challenge"
						? `${challenge.includes("blink") ? "Blink naturally " : ""}${
								challenge.includes("turn") ? "and turn your head left and right" : ""
							}`
						: framing.message}
				</p>
				<div className="mt-4 flex items-center gap-3">
					<button
						type="button"
						onClick={handleStartChallenge}
						disabled={stage === "challenge" || !framing.ok}
						className="px-5 py-3 rounded-lg text-sm font-bold bg-rankd-accent text-white disabled:opacity-50"
					>
						Start verification
					</button>
					<button
						type="button"
						onClick={handleCancel}
						className="px-5 py-3 rounded-lg text-sm font-bold border border-rankd-border"
					>
						Cancel
					</button>
				</div>
			</div>

			{stage === "processing" && <p className="text-sm text-rankd-faint">Processing…</p>}

			{stage === "done" && (
				<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-5 text-sm flex flex-col gap-3">
					<p>{resultMessage}</p>
					{!verified && (
						<button
							type="button"
							onClick={() => setStage("idle")}
							className="self-start text-rankd-accent font-bold"
						>
							Try again
						</button>
					)}
					<a href="/profile" className="self-start text-rankd-accent font-bold">
						Back to profile
					</a>
				</div>
			)}
		</div>
	);
}
