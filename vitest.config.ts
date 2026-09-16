/* eslint-disable import/no-nodejs-modules -- fileURLToPath(node:url) 用于把 import.meta.url 转成系统路径（含中文/Windows 盘符），供 vitest 别名解析。 */
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
