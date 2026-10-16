import { afterEach, describe, expect, it, vi } from "vitest";
import type { App, PluginManifest } from "obsidian";
import TagFolderPlugin from "../main";
import { getAppLanguage, setAppLanguage } from "../locale";
import { viewItem } from "./test-utils";

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

afterEach(() => setAppLanguage("en"));

describe("plug-in locale initialisation", () => {
	it("configures application collation before creating the saved item comparator", async () => {
		const plugin = new TagFolderPlugin({} as App, {} as PluginManifest);
		plugin.loadData = vi.fn().mockResolvedValue({ sortType: "NAME_ASC" });
		plugin.loadTagInfo = vi.fn().mockResolvedValue(undefined);
		await plugin.loadSettings();
		expect(getAppLanguage()).toBe("ja");
		expect(plugin.compareItems(viewItem("政治.md", []), viewItem("英语.md", []))).toBeGreaterThan(0);
	});
});
