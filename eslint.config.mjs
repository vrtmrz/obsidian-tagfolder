import tsParser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";
import * as sveltePlugin from "eslint-plugin-svelte";
import svelteParser from "svelte-eslint-parser";
import { baseRules, obsidianRules } from "./eslint.config.common.mjs";

export default defineConfig([
    globalIgnores([
        // Build outputs and legacy files
        "**/build",
        "coverage",
        "**/main.js",
        "main_org.js",
        "package.json",
        "**/*.json",
        "**/node_modules/**",
        "**/dist/**",
        "**/*.config.mjs",
        "eslint.config.common.mjs",
        "**/*.config.js",
        "**/*.js",
        "**/*.mjs",
        "utilsdeno/**"
    ]),
    ...sveltePlugin.configs["flat/base"],
    ...obsidianmd.configs.recommended,
    {
        files: ["**/*.{ts,cts,mts,tsx}"],
        languageOptions: {
            globals: { ...globals.browser },
            parser: tsParser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        linterOptions: {
            reportUnusedDisableDirectives: false,
        },
        rules: {
            ...baseRules,
            ...obsidianRules,
        },
    },
    {
        files: ["**/*.svelte"],
        languageOptions: {
            globals: { ...globals.browser },
            parser: svelteParser,
            parserOptions: {
                parser: tsParser,
                extraFileExtensions: [".svelte"],
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "no-unused-vars": "off",
            ...obsidianRules,
        },
    },
    {
        // Tests and their configuration run in Node.js.
        files: ["tests/**/*.ts", "test/e2e-obsidian/**/*.mts", "vitest.config.ts"],
        languageOptions: {
            globals: { ...globals.node },
        },
        rules: {
            ...Object.fromEntries(Object.keys(obsidianmd.rules).map((rule) => [`obsidianmd/${rule}`, "off"])),
            "no-restricted-globals": "off",
            "@typescript-eslint/no-restricted-imports": "off",
            "import/no-extraneous-dependencies": ["warn", { devDependencies: true }],
        },
    },
]);
