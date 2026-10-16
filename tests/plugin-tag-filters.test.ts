import { describe, expect, it, vi } from "vitest";
import { TFile, type App } from "obsidian";
import TagFolderPlugin from "../main";
import { openNoteLookup } from "../note-lookup-modal";
import { buildNoteLookupItems } from "../note-lookup";
import { DEFAULT_SETTINGS } from "../types";

vi.mock("../ScrollView", () => ({ ScrollView: class {} }));
vi.mock("../TagFolderView", () => ({ TagFolderView: class {} }));
vi.mock("../TagFolderList", () => ({ TagFolderList: class {} }));
vi.mock("../note-lookup-modal", () => ({ openNoteLookup: vi.fn() }));
vi.mock("@vrtmrz/obsidian-plugin-kit/ui", () => ({ createObsidianUi: vi.fn() }));
vi.mock("@vrtmrz/obsidian-plugin-kit/vault", () => ({
	createObsidianVaultFrontmatterAccess: vi.fn(),
	createObsidianVaultTextAccess: vi.fn(),
}));
vi.mock("obsidian", async (importOriginal) => ({
	...await importOriginal<typeof import("obsidian")>(),
	getAllTags: (metadata: { tags: string[] }) => metadata.tags,
}));

function pluginWithTags(tags: string[]) {
	const plugin = new TagFolderPlugin({} as App, {
		id: "obsidian-tagfolder", name: "TagFolder", version: "0.18.22",
		minAppVersion: "1.7.2", author: "test", description: "test",
	});
	plugin.settings = {
		...structuredClone(DEFAULT_SETTINGS),
		useTagInfo: false, useVirtualTag: false, displayFolderAsTag: false,
	};
	plugin.app = {
		metadataCache: { getFileCache: () => ({ tags }) },
	} as unknown as App;
	plugin.captureNoteLookupItems = vi.fn().mockReturnValue([]);
	return plugin;
}

function cachedFile(path: string, tags: string[]) {
	const file = new TFile();
	file.path = path;
	file.basename = path.replace(/\.md$/, "");
	file.stat = { ctime: 0, mtime: 0, size: 0 };
	return { file, tags, links: [] };
}

describe("note lookup filter integration", () => {
	it("omits glob-filtered tags from similar-note initial conditions", () => {
		const plugin = pluginWithTags(["#private/client", "#hidden/client", "#project", "#exact/child"]);
		plugin.settings.ignoreDocTags = "#private/*";
		plugin.settings.ignoreTags = "#hidden/*,exact";
		const source = new TFile();
		source.path = "source.md";

		plugin.openNoteLookupDialog(source);

		expect(vi.mocked(openNoteLookup).mock.lastCall?.[1].initialConditions).toEqual([
			{ tag: "project", excluded: false },
			{ tag: "exact/child", excluded: false },
		]);
	});

	it("uses the same ignored-note and ignored-tag patterns in the tree and note lookup", async () => {
		const plugin = pluginWithTags([]);
		plugin.settings.ignoreDocTags = "#private/*";
		plugin.settings.ignoreTags = "#hidden/*,exact";
		plugin.fileCaches = [
			cachedFile("parent.md", ["#private", "#project"]),
			cachedFile("ignored.md", ["#private/client", "#project"]),
			cachedFile("visible.md", ["#hidden/client", "#project", "#exact/child"]),
		];
		vi.spyOn(plugin, "getDisplayName").mockImplementation((file) => file.basename);

		const tree = await plugin.getItemsList("tag");
		const lookup = buildNoteLookupItems(plugin.fileCaches.map(({ file, tags }) => ({
			path: file.path, title: file.basename, tags, mtime: 0,
		})), plugin.getNoteLookupPolicy());
		const expected = [
			["parent.md", ["private", "project"]],
			["visible.md", ["project", "exact/child"]],
		];
		expect(tree.map((item) => [item.path, item.tags])).toEqual(expected);
		expect(lookup.map((item) => [item.path, item.tags])).toEqual(expected);
	});

	it("keeps flat-tree archived notes under their matching tags", async () => {
		const plugin = pluginWithTags([]);
		plugin.settings.disableNarrowingDown = true;
		plugin.settings.archiveTags = "*/done";
		plugin.fileCaches = [cachedFile("archived.md", ["#archive/done", "#project"])];
		vi.spyOn(plugin, "getDisplayName").mockImplementation((file) => file.basename);

		const tree = await plugin.getItemsList("tag");

		expect(tree.map((item) => [item.path, item.tags])).toEqual([
			["archived.md", ["archive/done"]],
		]);
	});
});
