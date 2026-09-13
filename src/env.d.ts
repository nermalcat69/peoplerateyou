declare global {
	interface Env {
		IMAGE_SIGNING_KEY: string;
		BETTER_AUTH_SECRET: string;
	}
}

export {};
