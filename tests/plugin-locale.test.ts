import { afterEach, describe, expect, it, vi } from "vitest";
import type { App, PluginManifest } from "obsidian";
import TagFolderPlugin from "../main";
import { getAppLanguage, setAppLanguage } from "../locale";
import { viewItem } from "./test-utils";
import { applyLanguagePreference, tr } from "../i18n";

vi.mock("obsidian", async (importOriginal) => ({
	...await importOriginal<typeof import("obsidian")>(),
	getLanguage: () => "ja",
	moment: { locale: () => "en" },
}));

vi.mock("@vrtmrz/obsidian-plugin-kit/ui", () => ({ createObsidianUi: vi.fn() }));
vi.mock("@vrtmrz/obsidian-plugin-kit/vault", () => ({
	createObsidianVaultFrontmatterAccess: vi.fn(),
	createObsidianVaultTextAccess: vi.fn(),
}));
vi.mock("../ScrollView", () => ({ ScrollView: class {} }));
vi.mock("../TagFolderView", () => ({ TagFolderView: class {} }));
vi.mock("../TagFolderList", () => ({ TagFolderList: class {} }));
vi.mock("../note-lookup-modal", () => ({ openNoteLookup: vi.fn() }));

afterEach(() => {
	setAppLanguage("en");
	applyLanguagePreference("en");
});

describe("plug-in locale initialisation", () => {
	it("configures application collation before creating the saved item comparator", async () => {
		const plugin = new TagFolderPlugin({} as App, {} as PluginManifest);
		plugin.loadData = vi.fn().mockResolvedValue({ sortType: "NAME_ASC" });
		plugin.loadTagInfo = vi.fn().mockResolvedValue(undefined);
		await plugin.loadSettings();
		expect(getAppLanguage()).toBe("ja");
		expect(plugin.compareItems(viewItem("政治.md", []), viewItem("英语.md", []))).toBeGreaterThan(0);
	});

	it.each(["TAGGROUP_ASC", "TAGGROUP_DESC"] as const)("loads %s with Japanese collation and an independently selected interface", async (sortType) => {
		const plugin = new TagFolderPlugin({} as App, {} as PluginManifest);
		plugin.loadData = vi.fn().mockResolvedValue({ sortType, uiLanguage: "zh-CN" });
		plugin.loadTagInfo = vi.fn().mockResolvedValue(undefined);
		await plugin.loadSettings();
		const items = [
			viewItem("politics-parent.md", ["root", "政治"]),
			viewItem("english-child.md", ["root", "英语", "政治"]),
			viewItem("politics-child.md", ["root", "政治", "英语"]),
			viewItem("english-parent.md", ["root", "英语"]),
		];
		const expected = ["english-parent.md", "english-child.md", "politics-parent.md", "politics-child.md"];
		if (sortType === "TAGGROUP_DESC") expected.reverse();
		expect(tr("Tags")).toBe("标签");
		expect([...items].sort(plugin.compareItems).map((item) => item.filename)).toEqual(expected);
		applyLanguagePreference("en");
		expect(tr("Tags")).toBe("Tags");
		expect(getAppLanguage()).toBe("ja");
		expect([...items].sort(plugin.compareItems).map((item) => item.filename)).toEqual(expected);
	});
});
