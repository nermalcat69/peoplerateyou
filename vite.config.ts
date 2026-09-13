import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		tsconfigPaths(),
	],
	build: {
		// "cloudflare:workers" is a Workers-runtime-only virtual module. Server
		// code that imports it (dynamically, so it's never eagerly evaluated on
		// the client) still needs Rollup to resolve the specifier when bundling
		// the client environment, even though that code path never runs there.
		rollupOptions: { external: ["cloudflare:workers"] },
	},
});
