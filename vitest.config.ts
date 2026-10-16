import { defineConfig } from "vitest/config";
import { compile } from "svelte/compiler";

const root = new URL(".", import.meta.url).pathname;

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
