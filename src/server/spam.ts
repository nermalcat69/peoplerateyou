const URL_PATTERN = /(https?:\/\/|www\.)\S+/gi;
// 8+ repeats of a 1-3 char run, e.g. "aaaaaaaa", "hahahahaha", "!!!!!!!!".
const REPETITION_PATTERN = /(.{1,3})\1{7,}/i;

export function looksLikeSpam(text: string): boolean {
	const links = text.match(URL_PATTERN);
	if (links && links.length > 1) return true;
	if (REPETITION_PATTERN.test(text)) return true;
	return false;
}

export function assertNotSpam(text: string): void {
	if (looksLikeSpam(text)) throw new Error("This looks like spam — remove excess links or repeated characters");
}
