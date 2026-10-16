import { afterEach, describe, expect, it, vi } from "vitest";
import { compareStrings, createStringComparator, detectAppLanguage, getAppLanguage, setAppLanguage } from "../locale";

afterEach(() => setAppLanguage("en"));

describe("application language selection", () => {
	it("prefers the official API without consulting legacy sources", () => {
		const getStoredLanguage = vi.fn(() => "en");
		const getMomentLocale = vi.fn(() => "en");
		expect(detectAppLanguage({ getLanguage: () => "ja", getStoredLanguage, getMomentLocale })).toBe("ja");
		expect(getStoredLanguage).not.toHaveBeenCalled();
		expect(getMomentLocale).not.toHaveBeenCalled();
	});

	it("uses the existing stored language on older Obsidian versions", () => {
		expect(detectAppLanguage({ getStoredLanguage: () => "zh_tw", getMomentLocale: () => "en" })).toBe("zh-TW");
	});

	it("uses Moment when the other sources are missing, invalid, or inaccessible", () => {
		expect(detectAppLanguage({
			getLanguage: () => "not a locale",
			getStoredLanguage: () => { throw new Error("Storage unavailable"); },
			getMomentLocale: () => "zh-cn",
		})).toBe("zh-CN");
		expect(detectAppLanguage({})).toBe("en");
	});

	it("maps the application's legacy Khmer language code to its locale", () => {
		expect(detectAppLanguage({ getLanguage: () => "kh" })).toBe("km");
	});
});

describe("locale-aware string comparison", () => {
	it.each([
		["en", ["政治", "英语"]],
		["ja", ["英语", "政治"]],
		["zh-CN", ["英语", "政治"]],
	] as const)("uses the explicitly selected %s collation", (language, expected) => {
		setAppLanguage(language);
		expect(["政治", "英语"].sort((left, right) => compareStrings(left, right))).toEqual(expected);
	});

	it("preserves natural numeric order and separate lookup sensitivity", () => {
		setAppLanguage("en");
		expect(compareStrings("note2", "note10")).toBeLessThan(0);
		expect(compareStrings("A", "a", { sensitivity: "base" })).toBe(0);
		expect(compareStrings("A", "a")).not.toBe(0);
	});

	it("invalidates cached comparators when the application language changes", () => {
		setAppLanguage("en");
		expect(compareStrings("政治", "英语")).toBeLessThan(0);
		setAppLanguage("ja");
		expect(compareStrings("政治", "英语")).toBeGreaterThan(0);
	});

	it("keeps an existing comparator bound to its selected locale", () => {
		const compare = createStringComparator("en");
		setAppLanguage("ja");
		expect(compare("政治", "英语")).toBeLessThan(0);
		expect(getAppLanguage()).toBe("ja");
	});

	it("falls back to English for invalid or unsupported locales", () => {
		expect(createStringComparator("not a locale")("政治", "英语")).toBeLessThan(0);
		expect(createStringComparator("xx")("政治", "英语")).toBeLessThan(0);
	});
});
