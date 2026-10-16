import { afterEach, describe, expect, it } from "vitest";
import { compareStrings, createStringComparator, detectAppLanguage, getAppLanguage, setAppLanguage } from "../locale";

afterEach(() => setAppLanguage("en"));

describe("application language selection", () => {
	it("uses the language reported by the official API", () => {
		expect(detectAppLanguage({ getLanguage: () => "ja" })).toBe("ja");
	});

	it("normalises legacy language codes", () => {
		expect(detectAppLanguage({ getLanguage: () => "zh_tw" })).toBe("zh-TW");
	});

	it("uses English when the language is missing, invalid, or inaccessible", () => {
		expect(detectAppLanguage({
			getLanguage: () => "not a locale",
		})).toBe("en");
		expect(detectAppLanguage({
			getLanguage: () => { throw new Error("Language unavailable"); },
		})).toBe("en");
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
