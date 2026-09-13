const PBKDF2_ITERATIONS = 100_000;

function toHex(bytes: ArrayBuffer | Uint8Array): string {
	return [...new Uint8Array(bytes)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function fromHex(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export function randomToken(byteLength = 32): string {
	return toHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function hashPassword(
	password: string,
): Promise<{ hash: string; salt: string }> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = await derivePasswordHash(password, salt);
	return { hash: toHex(hash), salt: toHex(salt) };
}

export async function verifyPassword(
	password: string,
	salt: string,
	hash: string,
): Promise<boolean> {
	const derived = await derivePasswordHash(password, fromHex(salt));
	return timingSafeEqual(toHex(derived), hash);
}

async function derivePasswordHash(
	password: string,
	salt: Uint8Array,
): Promise<ArrayBuffer> {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	return crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
		keyMaterial,
		256,
	);
}

export async function hmacHex(key: string, message: string): Promise<string> {
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(key),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		cryptoKey,
		new TextEncoder().encode(message),
	);
	return toHex(signature);
}
