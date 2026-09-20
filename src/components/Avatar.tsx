import { accentFor, initials } from "../lib/avatar";
import { IconBadgeCheck } from "./icons";

const SIZE_CLASSES = {
	sm: "size-9 text-sm",
	md: "size-11 text-base",
	lg: "size-14 text-lg",
	xl: "size-24 text-3xl",
	"2xl": "size-30 text-4xl",
} as const;

const BADGE_SIZE = {
	sm: 12,
	md: 13,
	lg: 15,
	xl: 20,
	"2xl": 24,
} as const;

export function Avatar({
	id,
	name,
	image,
	size = "md",
	verified = false,
}: {
	id: string;
	name: string;
	image?: string | null;
	size?: keyof typeof SIZE_CLASSES;
	verified?: boolean;
}) {
	const content = image ? (
		<img
			src={image}
			alt={name}
			className={`${SIZE_CLASSES[size]} rounded-full object-cover shrink-0`}
		/>
	) : (
		<div className={`${SIZE_CLASSES[size]} rounded-full ${ACCENT_BG[accentFor(id)]} flex items-center justify-center shrink-0`}>
			<span className="font-display font-extrabold uppercase text-rankd-ink">{initials(name)}</span>
		</div>
	);

	if (!verified) return content;

	return (
		<span className="relative inline-flex shrink-0">
			{content}
			<span
				className="absolute -bottom-0.5 -right-0.5 rounded-full bg-rankd-bg flex items-center justify-center p-0.5"
				title="Verified"
			>
				<IconBadgeCheck size={BADGE_SIZE[size]} className="text-rankd-accent" />
			</span>
		</span>
	);
}

const ACCENT_BG = {
	"rankd-blue": "bg-rankd-blue",
	"rankd-purple": "bg-rankd-purple",
	"rankd-yellow": "bg-rankd-yellow",
	"rankd-pink": "bg-rankd-pink",
} as const;
