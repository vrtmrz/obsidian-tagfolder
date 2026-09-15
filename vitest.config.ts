/* eslint-disable import/no-nodejs-modules -- fileURLToPath(node:url) 用于把 import.meta.url 转成系统路径（含中文/Windows 盘符），供 vitest 别名解析。 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

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
		coverage: {
			include: ["new-note-template.ts", "util.ts", "v2codebehind.ts"],
			exclude: ["tests/**"],
		},
	},
});
