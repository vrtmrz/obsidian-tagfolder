import { afterEach, describe, expect, it, vi } from "vitest";
import { TFile, type App, type PluginManifest } from "obsidian";
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

	it.each(["TAGGROUP_ASC", "TAGGROUP_DESC"] as const)("applies glob filters before %s with Japanese collation and a Chinese interface", async (sortType) => {
		const plugin = new TagFolderPlugin({} as App, {} as PluginManifest);
		plugin.loadData = vi.fn().mockResolvedValue({
			sortType, uiLanguage: "zh-CN", ignoreDocTags: "private/*", ignoreTags: "hidden/*",
		});
		plugin.loadTagInfo = vi.fn().mockResolvedValue(undefined);
		await plugin.loadSettings();
		const notes: Array<[string, string[]]> = [
			["eight-child.md", ["#project", "#八", "#一"]],
			["one-child.md", ["#project", "#一", "#八"]],
			["eight-parent.md", ["#project", "#八"]],
			["one-parent.md", ["#project", "#hidden/client", "#一"]],
			["ignored.md", ["#project", "#private/client", "#一"]],
		];
		plugin.fileCaches = notes.map(([path, tags]) => {
			const file = new TFile();
			file.path = path;
			file.basename = file.path.replace(/\.md$/, "");
			file.stat = { ctime: 0, mtime: 0, size: 0 };
			return { file, tags, links: [] };
		});
		vi.spyOn(plugin, "getDisplayName").mockImplementation((file) => file.basename);
		const items = await plugin.getItemsList("tag");
		const expected = ["one-parent.md", "one-child.md", "eight-parent.md", "eight-child.md"];
		if (sortType === "TAGGROUP_DESC") expected.reverse();

		expect(tr("Tags")).toBe("标签");
		expect(getAppLanguage()).toBe("ja");
		expect(items.sort(plugin.compareItems).map((item) => item.path)).toEqual(expected);
		expect(items.find((item) => item.path === "one-parent.md")?.tags).toEqual(["project", "一"]);
	});
});
