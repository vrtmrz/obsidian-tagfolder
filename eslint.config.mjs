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
        files: ["**/*.ts"],
        languageOptions: {
            globals: { ...globals.browser },
            parser: tsParser,
            parserOptions: {
                projectService: true,
                rootDir: "./",
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
                rootDir: "./",
            },
        },
        rules: {
            "no-unused-vars": "off",
            ...obsidianRules,
        },
    },
]);
