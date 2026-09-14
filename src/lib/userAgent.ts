export function describeUserAgent(ua: string | null | undefined): string {
	if (!ua) return "Unknown device";

	const browser = /Edg\//.test(ua)
		? "Edge"
		: /Chrome\//.test(ua)
			? "Chrome"
			: /Firefox\//.test(ua)
				? "Firefox"
				: /Safari\//.test(ua)
					? "Safari"
					: "a browser";

	const os = /Windows/.test(ua)
		? "Windows"
		: /Mac OS X/.test(ua)
			? "macOS"
			: /Android/.test(ua)
				? "Android"
				: /iPhone|iPad/.test(ua)
					? "iOS"
					: /Linux/.test(ua)
						? "Linux"
						: "an unknown OS";

	return `${browser} on ${os}`;
}
