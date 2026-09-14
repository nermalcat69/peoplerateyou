import { accentFor, initials } from "../lib/avatar";

const SIZE_CLASSES = {
	sm: "size-9 text-sm",
	md: "size-11 text-base",
	lg: "size-14 text-lg",
	xl: "size-24 text-3xl",
	"2xl": "size-30 text-4xl",
} as const;

export function Avatar({
	id,
	name,
	image,
	size = "md",
}: {
	id: string;
	name: string;
	image?: string | null;
	size?: keyof typeof SIZE_CLASSES;
}) {
	if (image) {
		return (
			<img
				src={image}
				alt={name}
				className={`${SIZE_CLASSES[size]} rounded-full object-cover shrink-0`}
			/>
		);
	}

	const accentClass = ACCENT_BG[accentFor(id)];
	return (
		<div className={`${SIZE_CLASSES[size]} rounded-full ${accentClass} flex items-center justify-center shrink-0`}>
			<span className="font-display font-extrabold uppercase text-rankd-ink">{initials(name)}</span>
		</div>
	);
}

const ACCENT_BG = {
	"rankd-blue": "bg-rankd-blue",
	"rankd-purple": "bg-rankd-purple",
	"rankd-yellow": "bg-rankd-yellow",
	"rankd-pink": "bg-rankd-pink",
} as const;
