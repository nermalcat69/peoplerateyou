type IconProps = { size?: number; className?: string };

function base(size: number) {
	return {
		width: size,
		height: size,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.8,
		strokeLinecap: "round" as const,
		strokeLinejoin: "round" as const,
	};
}

export function IconUser({ size = 20, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<circle cx="12" cy="8" r="3.5" />
			<path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
		</svg>
	);
}

export function IconUsers({ size = 20, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<circle cx="9" cy="8" r="3" />
			<circle cx="16" cy="9.5" r="2.4" />
			<path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
			<path d="M15.3 14.3c2.1.4 3.7 2.2 3.7 4.7" />
		</svg>
	);
}

export function IconStar({ size = 20, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<path d="M12 3.5l2.4 5 5.4.7-4 3.8 1 5.5-4.8-2.6-4.8 2.6 1-5.5-4-3.8 5.4-.7z" />
		</svg>
	);
}

export function IconCompass({ size = 20, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<circle cx="12" cy="12" r="9" />
			<path d="M15.2 9.2l-2 4.6-4.6 1.8 2-4.6z" />
		</svg>
	);
}

export function IconGear({ size = 20, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<circle cx="12" cy="12" r="3" />
			<path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
		</svg>
	);
}

export function IconChevronRight({ size = 14, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<path d="M9 6l6 6-6 6" />
		</svg>
	);
}

export function IconChevronLeft({ size = 14, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<path d="M15 6l-6 6 6 6" />
		</svg>
	);
}

export function IconArrowRight({ size = 16, className }: IconProps) {
	return (
		<svg {...base(size)} className={className} strokeWidth={2}>
			<path d="M4 12h16M13 5l7 7-7 7" />
		</svg>
	);
}

export function IconSearch({ size = 15, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<circle cx="10.5" cy="10.5" r="6.5" />
			<path d="M20 20l-4.3-4.3" />
		</svg>
	);
}

export function IconFilter({ size = 14, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<path d="M4 6h16M7 12h10M10 18h4" />
		</svg>
	);
}

export function IconSort({ size = 14, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
		</svg>
	);
}

export function IconMapPin({ size = 14, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z" />
			<circle cx="12" cy="9.5" r="2.3" />
		</svg>
	);
}

export function IconEye({ size = 18, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
			<circle cx="12" cy="12" r="2.6" />
		</svg>
	);
}

export function IconPencil({ size = 15, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<path d="M4 20l1-4.5L16.5 4 20 7.5 8.5 19z" />
			<path d="M14.5 6L18 9.5" />
		</svg>
	);
}

export function IconTrendingUp({ size = 18, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<path d="M3 17l6-6 4 4 8-8" />
			<path d="M15 6h6v6" />
		</svg>
	);
}

export function IconFlame({ size = 16, className }: IconProps) {
	return (
		<svg {...base(size)} className={className}>
			<path d="M12 21c4 0 6.5-2.7 6.5-6 0-3-2-4.7-2.8-6.6-.5 1.4-1.4 2-1.4 2C14.8 6.7 13 4 12 2c-.5 3-2.8 5-4 7-1 1.6-2.5 3.4-2.5 6 0 3.3 2.5 6 6.5 6z" />
		</svg>
	);
}

export function IconImage({ size = 30, className }: IconProps) {
	return (
		<svg {...base(size)} className={className} strokeWidth={1.6}>
			<rect x="3" y="4" width="18" height="16" rx="2" />
			<circle cx="8.5" cy="9.5" r="1.6" />
			<path d="M3 16l5-5 4 4 3-3 5 5" />
		</svg>
	);
}
