const ACCENTS = ["rankd-green", "rankd-blue", "rankd-purple", "rankd-yellow", "rankd-pink"] as const;

export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
	return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function accentFor(id: string): (typeof ACCENTS)[number] {
	let hash = 0;
	for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
	return ACCENTS[hash % ACCENTS.length]!;
}

export function slugify(name: string): string {
	const slug = name
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "")
		.slice(0, 20);
	return slug || "user";
}
