import { defineConfig } from "vitest/config";

const root = new URL(".", import.meta.url).pathname;

export default defineConfig({
	resolve: {
		alias: {
			obsidian: `${root}tests/mocks/obsidian.ts`,
			store: `${root}store.ts`,
			types: `${root}types.ts`,
			dialog: `${root}dialog.ts`,
		},
	},
	test: {
		environment: "jsdom",
		setupFiles: ["./tests/setup.ts"],
	},
});
