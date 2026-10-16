import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

// Follow the scanner policy in obsidianmd/obsidian-workflows at 8167cae.
const scannerIgnores = [
    "node_modules", "dist", "build", "pkg", "test-vault", ".obsidian", "**/.obsidian/**",
    "esbuild.config.mjs", "version-bump.mjs",
    "**/*.test.*", "**/*.tests.*", "**/*.spec.*", "**/*.specs.*",
    "**/test/**", "**/tests/**", "**/__tests__/**", "**/mocks/**", "**/__mocks__/**",
    "**/*.cjs", "**/*.mjs", "**/*.cts", "**/*.mts", "**/vite*", "**/scripts/**", "**/docs/**",
    "**/i18n/**", "**/i18next/**", "**/locale/**", "**/locales/**", "**/translations/**", "**/l10n/**",
    ".pnpm-store", "**/testUtils**", "automation/**", "e2e-tests/**",
];

function reviewConfiguration(configuration) {
    if (Array.isArray(configuration)) return configuration.map(reviewConfiguration);
    const result = { ...configuration };
    if (result.extends) result.extends = reviewConfiguration(result.extends);
    if (result.rules) {
        result.rules = Object.fromEntries(Object.entries(result.rules).map(([name, setting]) => {
            if (name.startsWith("eslint-comments/")) return [name, setting];
            if (setting === "error" || setting === 2) return [name, "warn"];
            if (Array.isArray(setting) && (setting[0] === "error" || setting[0] === 2)) {
                return [name, ["warn", ...setting.slice(1)]];
            }
            return [name, setting];
        }));
    }
    return result;
}

export default defineConfig([
    globalIgnores([...scannerIgnores, "eslint.config.scanner.mjs", "main.js", "styles.css", "manifest.json"]),
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ["eslint.config.js", "eslint.config.mjs", "eslint.config.mts"],
                },
                tsconfigRootDir: import.meta.dirname,
                extraFileExtensions: [".json"],
            },
        },
    },
    ...reviewConfiguration(obsidianmd.configs.recommended),
    {
        linterOptions: {
            noInlineConfig: false,
            reportUnusedDisableDirectives: "off",
            reportUnusedInlineConfigs: "off",
        },
    },
    {
        files: ["**/*.{ts,cts,mts,tsx,js,cjs,mjs,jsx}"],
        rules: {
            "no-eval": "error",
            "no-implied-eval": "error",
            "no-unsanitized/method": "error",
            "no-unsanitized/property": "error",
            "obsidianmd/regex-lookbehind": "error",
            "obsidianmd/no-forbidden-elements": "error",
            "no-undef": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/no-base-to-string": "off",
            "import/no-unresolved": "off",
            "obsidianmd/validate-manifest": "off",
            "obsidianmd/validate-license": "off",
            "obsidianmd/commands/no-command-in-command-id": "off",
            "obsidianmd/commands/no-plugin-id-in-command-id": "off",
        },
    },
    {
        files: ["**/*.{ts,tsx,js,jsx}"],
        rules: {
            "obsidianmd/ui/sentence-case": "off",
            "obsidianmd/ui/sentence-case-json": "off",
            "obsidianmd/ui/sentence-case-locale-module": "off",
            "eslint-comments/require-description": "error",
            "@typescript-eslint/no-unsafe-member-access": "warn",
            "@typescript-eslint/no-unsafe-assignment": "warn",
            "@typescript-eslint/no-unsafe-argument": "warn",
            "@typescript-eslint/no-unsafe-call": "warn",
            "@typescript-eslint/no-unsafe-return": "warn",
            "obsidianmd/commands/no-command-in-command-id": "warn",
            "obsidianmd/commands/no-plugin-id-in-command-id": "warn",
            "obsidianmd/settings-tab/no-manual-html-headings": "error",
            "obsidianmd/settings-tab/no-problematic-settings-headings": "error",
            "obsidianmd/sample-names": "error",
            "obsidianmd/no-sample-code": "error",
            "obsidianmd/platform": "error",
            "obsidianmd/no-plugin-as-component": "error",
            "obsidianmd/detach-leaves": "error",
            "obsidianmd/no-static-styles-assignment": "error",
            "obsidianmd/no-view-references-in-plugin": "error",
            "obsidianmd/no-unsupported-api": "error",
        },
    },
]);
