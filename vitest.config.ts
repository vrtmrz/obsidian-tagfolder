import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { compile } from "svelte/compiler";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	plugins: [{
		name: "compile-svelte-tests",
		transform(source, id) {
			if (!id.endsWith(".svelte")) return;
			return compile(source, { filename: id, generate: "client" }).js;
		},
	}],
	resolve: {
		conditions: ["browser"],
		// Keep source imports ahead of a previous build's main.js artefact.
		extensions: [".ts", ".mts", ".mjs", ".js", ".tsx", ".jsx", ".json"],
		alias: {
			obsidian: `${root}tests/mocks/obsidian.ts`,
			store: `${root}store.ts`,
			types: `${root}types.ts`,
			dialog: `${root}dialog.ts`,
		},
	},
	test: {
		environment: "jsdom",
		server: { deps: { inline: ["svelte"] } },
		setupFiles: ["./tests/setup.ts"],
		coverage: {
			include: ["new-note-template.ts", "util.ts", "v2codebehind.ts"],
			exclude: ["tests/**"],
		},
	},
});
