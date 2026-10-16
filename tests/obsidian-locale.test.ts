import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureAppLocale } from "../obsidian-locale";
import { getAppLanguage, setAppLanguage } from "../locale";
import { compare } from "../util";
import { buildNoteLookupItems, getTagCompletions, rankNoteLookupItems } from "../note-lookup";

const sources = vi.hoisted(() => ({
	getLanguage: undefined as (() => string) | undefined,
	getMomentLocale: (): string => "en",
}));

vi.mock("obsidian", () => ({
	get getLanguage() { return sources.getLanguage; },
	moment: { locale: () => sources.getMomentLocale() },
}));

beforeEach(() => {
	window.localStorage.clear();
	sources.getLanguage = undefined;
	sources.getMomentLocale = () => "en";
});

afterEach(() => {
	window.localStorage.clear();
	setAppLanguage("en");
});

describe("Obsidian locale integration", () => {
	it("uses the official API ahead of an old stored language", () => {
		sources.getLanguage = () => "ja";
		window.localStorage.setItem("language", "en");
		configureAppLocale();
		expect(getAppLanguage()).toBe("ja");
		expect(compare("政治", "英语")).toBeGreaterThan(0);
	});

	it("retains the stored-language and Moment fallbacks without the new API", () => {
		window.localStorage.setItem("language", "zh_tw");
		configureAppLocale();
		expect(getAppLanguage()).toBe("zh-TW");
		window.localStorage.clear();
		sources.getMomentLocale = () => "ja";
		configureAppLocale();
		expect(getAppLanguage()).toBe("ja");
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
