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
import { completeVerificationFn, getVerificationStatusFn, setReferencePhotoFn } from "../server/verification";

export const Route = createFileRoute("/_authenticated/verify-photo")({
	loader: () => getVerificationStatusFn(),
	component: VerifyPhotoPage,
});

type Stage = "idle" | "camera" | "challenge" | "processing" | "done";

const DEFAULT_FRAMING: FaceFraming = { ok: false, message: "Center yourself in frame", faceHeightRatio: 0 };

function VerifyPhotoPage() {
	const status = Route.useLoaderData();
	const router = useRouter();
	const setReferencePhoto = useServerFn(setReferencePhotoFn);
	const completeVerification = useServerFn(completeVerificationFn);

	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const landmarksRef = useRef<NormalizedPoint[] | null>(null);
	const framingLoopRef = useRef<number | null>(null);

	const [needsReferencePhoto, setNeedsReferencePhoto] = useState(!status.hasReferencePhoto);
	const [stage, setStage] = useState<Stage>("idle");
	const [error, setError] = useState<string | null>(null);
	const [challenge, setChallenge] = useState<ChallengeStep[]>([]);
	const [resultMessage, setResultMessage] = useState<string | null>(null);
	const [verified, setVerified] = useState(status.status === "verified");
	const [framing, setFraming] = useState<FaceFraming>(DEFAULT_FRAMING);

	useEffect(() => {
		return () => {
			stopCamera();
			if (framingLoopRef.current !== null) cancelAnimationFrame(framingLoopRef.current);
		};
	}, []);

	function stopCamera() {
		streamRef.current?.getTracks().forEach((t) => t.stop());
		streamRef.current = null;
	}

	// Continuously tracks whether the person is well-framed (close enough,
	// centered) while the camera is on, so we only let them capture once
	// they're at roughly "webcam distance" — where face detection/matching
	// reliability is far higher than for a small, distant face in frame.
	function startFramingLoop() {
		let lastCheck = 0;
		async function tick(now: number) {
			if (!videoRef.current) return;
			if (now - lastCheck > 150) {
				lastCheck = now;
				const landmarks = await detectLandmarksOnce(videoRef.current);
				landmarksRef.current = landmarks;
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

	async function handleCaptureReferencePhoto() {
		if (!framing.ok || !landmarksRef.current) return;
		setStage("processing");
		setError(null);
		stopFramingLoop();
		try {
			const video = videoRef.current!;
			const landmarks = landmarksRef.current;
			const embedding = await computeFaceEmbedding(video, landmarks);

			const captureCanvas = document.createElement("canvas");
			captureCanvas.width = video.videoWidth;
			captureCanvas.height = video.videoHeight;
			captureCanvas.getContext("2d")!.drawImage(video, 0, 0);
			const blob: Blob = await new Promise((resolve, reject) =>
				captureCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Capture failed"))), "image/jpeg", 0.9),
			);

			const formData = new FormData();
			formData.append("file", blob, "reference.jpg");
			formData.append("embedding", JSON.stringify(embedding));
			await setReferencePhoto({ data: formData });

			stopCamera();
			await router.invalidate();
			setNeedsReferencePhoto(false);
			setStage("idle");
			setResultMessage(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't save your photo");
			setStage("camera");
			startFramingLoop();
		}
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
			const landmarks = await detectLandmarksOnce(video);
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
			setError(err instanceof Error ? err.message : "Verification failed, try again");
			setStage("camera");
			startFramingLoop();
		}
	}

	return (
		<div className="max-w-lg mx-auto px-4 py-10 flex flex-col gap-6">
			<div>
				<h1 className="font-display text-2xl font-extrabold">
					{needsReferencePhoto ? "Add your verification photo" : "Verify it's you"}
				</h1>
				<p className="text-sm text-rankd-faint mt-1.5">
					{needsReferencePhoto
						? "Take a live photo of yourself. It's used only to confirm future selfies are really you, and it's never shown to other users or posted to the feed."
						: "Follow the on-screen prompts (blink, turn your head) so we can confirm a live person, then match it to your reference photo."}
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
				<button
					type="button"
					onClick={startCamera}
					className="self-start px-5 py-3 rounded-lg text-sm font-bold bg-rankd-accent text-white"
				>
					{needsReferencePhoto ? "Turn on camera" : "Verify now"}
				</button>
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
				<button
					type="button"
					onClick={needsReferencePhoto ? handleCaptureReferencePhoto : handleStartChallenge}
					disabled={stage === "challenge" || !framing.ok}
					className="mt-4 px-5 py-3 rounded-lg text-sm font-bold bg-rankd-accent text-white disabled:opacity-50"
				>
					{needsReferencePhoto ? "Capture reference photo" : "Start verification"}
				</button>
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
