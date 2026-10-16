import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureAppLocale } from "../obsidian-locale";
import { getAppLanguage, setAppLanguage } from "../locale";
import { compare } from "../util";
import { buildNoteLookupItems, getTagCompletions, rankNoteLookupItems } from "../note-lookup";

const sources = vi.hoisted(() => ({
	getLanguage: undefined as (() => string) | undefined,
	supportsGetLanguage: true,
}));

vi.mock("obsidian", () => ({
	get getLanguage() { return sources.getLanguage; },
	requireApiVersion: (version: string) => version === "1.8.7" && sources.supportsGetLanguage,
}));

beforeEach(() => {
	window.localStorage.clear();
	sources.getLanguage = undefined;
	sources.supportsGetLanguage = true;
});

afterEach(() => {
	vi.restoreAllMocks();
	window.localStorage.clear();
	setAppLanguage("en");
});

describe("Obsidian locale integration", () => {
	it("uses English on older Obsidian without reading shared or vault-local language keys", () => {
		sources.supportsGetLanguage = false;
		window.localStorage.setItem("language", "zh_tw");
		window.localStorage.setItem("vault-a-language", JSON.stringify("zh-CN"));
		window.localStorage.setItem("vault-b-language", JSON.stringify("en"));
		const readStorage = vi.spyOn(Storage.prototype, "getItem");
		configureAppLocale();
		expect(getAppLanguage()).toBe("en");
		expect(readStorage).not.toHaveBeenCalled();
	});

	it("uses the official API ahead of an old stored language", () => {
		sources.getLanguage = () => "ja";
		window.localStorage.setItem("language", "en");
		const readStorage = vi.spyOn(Storage.prototype, "getItem");
		configureAppLocale();
		expect(getAppLanguage()).toBe("ja");
		expect(readStorage).not.toHaveBeenCalled();
		expect(compare("政治", "英语")).toBeGreaterThan(0);
	});

	it("uses English when the official API is unavailable", () => {
		window.localStorage.setItem("language", "zh_tw");
		configureAppLocale();
		expect(getAppLanguage()).toBe("en");
	});

	it("does not call the new API on an older Obsidian version", () => {
		sources.supportsGetLanguage = false;
		const readLanguage = vi.fn(() => "ja");
		sources.getLanguage = readLanguage;
		configureAppLocale();
		expect(getAppLanguage()).toBe("en");
		expect(readLanguage).not.toHaveBeenCalled();
	});

	it.each(["", "not a locale"])("uses English for an empty or invalid API result: %j", (language) => {
		sources.getLanguage = () => language;
		window.localStorage.setItem("language", "zh_tw");
		configureAppLocale();
		expect(getAppLanguage()).toBe("en");
	});

	it("uses English if the official API throws", () => {
		sources.getLanguage = () => { throw new Error("Language unavailable"); };
		window.localStorage.setItem("language", "zh_tw");
		configureAppLocale();
		expect(getAppLanguage()).toBe("en");
	});

	it("uses the same Japanese collation for file names, completions, and tied lookup results", () => {
		sources.getLanguage = () => "ja";
		configureAppLocale();
		const policy = { targetFolders: [], ignoreFolders: [], ignoreDocumentTags: [], ignoreTags: [], redirects: {}, splitNestedTags: false };
		const items = buildNoteLookupItems([
			{ path: "政治.md", title: "政治", tags: ["政治"], mtime: 0 },
			{ path: "英语.md", title: "英语", tags: ["英语"], mtime: 0 },
		], policy);
		expect(items.map((item) => item.path).sort(compare)).toEqual(["英语.md", "政治.md"]);
		expect(getTagCompletions(items, [], "").map((item) => item.tag)).toEqual(["英语", "政治"]);
		expect(rankNoteLookupItems(items, [], "").map((item) => item.path)).toEqual(["英语.md", "政治.md"]);
	});
});
