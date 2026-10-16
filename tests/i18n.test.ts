import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyLanguagePreference, tr, t } from "../i18n";
import { tagInfo } from "../store";
import { compare, renderSpecialTag } from "../util";
import { detectAppLanguage, getAppLanguage, setAppLanguage } from "../locale";

beforeEach(() => {
	setAppLanguage("en");
	applyLanguagePreference("en");
	tagInfo.set({});
});

afterEach(() => {
	setAppLanguage("en");
	applyLanguagePreference("en");
	tagInfo.set({});
});

function followAppLanguage(language: string) {
	setAppLanguage(detectAppLanguage({ getLanguage: () => language }));
	applyLanguagePreference("auto");
}

describe("interface translations", () => {
	it.each(["zh-TW", "zh-Hant", "zh-HK"])("falls back to English for the untranslated %s interface", (language) => {
		followAppLanguage(language);
		expect(tr("Tags")).toBe("Tags");
	});

	it("follows Simplified Chinese and permits an explicit English override", () => {
		followAppLanguage("zh");
		expect(tr("Tags")).toBe("标签");
		applyLanguagePreference("en");
		expect(tr("Tags")).toBe("Tags");
	});

	it("keeps Japanese collation when the interface falls back to English or changes explicitly", () => {
		setAppLanguage("ja");
		applyLanguagePreference("auto");
		expect(tr("Tags")).toBe("Tags");
		expect(compare("政治", "英语")).toBeGreaterThan(0);
		applyLanguagePreference("zh-CN");
		expect(tr("Tags")).toBe("标签");
		expect(getAppLanguage()).toBe("ja");
		expect(compare("政治", "英语")).toBeGreaterThan(0);
	});

	it("keeps user-defined tag labels unchanged when they match translation keys", () => {
		tagInfo.set({ project: { alt: "Tags" } });
		applyLanguagePreference("zh-CN");
		expect(renderSpecialTag("project")).toBe("Tags");
		expect(renderSpecialTag("_VIRTUAL_TAG_CANVAS")).toBe("📋 画布");
	});

	it("interpolates translated strings and untranslated source strings", () => {
		applyLanguagePreference("zh-CN");
		expect(tr("Files with {title}", { title: "report" })).toBe("包含 report 的文件");
		expect(tr("Unknown {name}", { name: "report" })).toBe("Unknown report");
	});

	it("updates the translator used by mounted components", () => {
		const labels: string[] = [];
		const unsubscribe = t.subscribe((translate) => labels.push(translate("Tags")));
		applyLanguagePreference("zh-CN");
		applyLanguagePreference("en");
		unsubscribe();
		expect(labels).toEqual(["Tags", "标签", "Tags"]);
	});
});
