import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAppLanguage } from "../locale";
import {
	DEFAULT_SETTINGS,
	type TagFolderSettings,
	type ViewItem,
} from "../types";
import {
	getExtraTags,
	getTagGroups,
	parseTagName,
	pathMatch,
	removeIntermediatePath,
	selectCompareMethodItemsByTagGroup,
	selectCompareMethodTags,
	V2FI_IDX_TAG,
} from "../util";
import type { V2FolderItem } from "../util";
import { viewItem } from "./test-utils";

describe("tag path helpers", () => {
	it("matches exact tags and nested tags only when the needle is a folder path", () => {
		expect(pathMatch("project/client", "project/client")).toBe(true);
		expect(pathMatch("project/client/report", "project/client/")).toBe(true);
		expect(pathMatch("project/client-report", "project/client/")).toBe(false);
	});

	it("removes intermediate parent paths while preserving separate branches", () => {
		expect(removeIntermediatePath(["project", "project/client", "area/home"])).toEqual([
			"area/home",
			"project/client",
		]);
	});

	it("keeps a repeated parent path as a selectable path", () => {
		expect(removeIntermediatePath(["test", "test/a", "test/b/c", "test"])).toEqual([
			"test",
			"test/b/c",
			"test/a",
		]);
	});
});

describe("tag display helpers", () => {
	it("parses nested tag names into a display prefix and leaf label", () => {
		expect(parseTagName("project/client/", {})).toEqual(["client", ["", "client"]]);
	});

	it("applies pinned mark information to the display name", () => {
		expect(parseTagName("client", { client: { key: "1" } })).toEqual(["client", ["📌client"]]);
		expect(parseTagName("client", { client: { key: "1", mark: "*" } })).toEqual(["client", ["*client"]]);
	});

	it("calculates suppressed extra tags by removing the current trail", () => {
		expect(getExtraTags(["project/client/report", "project/client/todo"], ["project/"], true)).toEqual([
			"client/report",
			"client/todo",
		]);
		expect(getExtraTags(["project/client/report", "project/client/todo"], ["project/client/"], true)).toEqual([
			"report",
			"todo",
		]);
	});
});

describe("tag sorting", () => {
	const settings = {
		...DEFAULT_SETTINGS,
		sortTypeTag: "NAME_ASC",
	} satisfies TagFolderSettings;

	function folder(tag: string, childrenCount = 0): V2FolderItem {
		const children = Array.from({ length: childrenCount }, (_, idx) => viewItem(`${tag}-${idx}.md`, [tag]));
		return [tag, tag, [tag], children];
	}

	it("sorts tags by natural name order", () => {
		const sort = selectCompareMethodTags(settings, {});
		const items = [folder("tag10"), folder("tag2"), folder("tag1")].sort(sort);
		expect(items.map((item) => item[V2FI_IDX_TAG])).toEqual(["tag1", "tag2", "tag10"]);
	});

	it("can sort by item count and then by name", () => {
		const sort = selectCompareMethodTags({ ...settings, sortTypeTag: "ITEMS_DESC" }, {});
		const items = [folder("small", 1), folder("large", 3), folder("medium", 2)].sort(sort);
		expect(items.map((item) => item[V2FI_IDX_TAG])).toEqual(["large", "medium", "small"]);
	});
});

describe("item sorting by tag grouping", () => {
	beforeEach(() => setAppLanguage("zh-CN"));
	afterEach(() => setAppLanguage("en"));

	const grouped = (sortType: "TAGGROUP_ASC" | "TAGGROUP_DESC") =>
		selectCompareMethodItemsByTagGroup({ ...DEFAULT_SETTINGS, sortType });
	const names = (items: ViewItem[]) =>
		items.map((item) => item.filename.replace(/\.md$/, ""));

	it.each(["TAGGROUP_ASC", "TAGGROUP_DESC"] as const)("keeps parent groups adjacent to their descendants in %s", (sortType) => {
		const items = [
			viewItem("parent.md", ["root", "a"]),
			viewItem("other.md", ["root", "b"]),
			viewItem("child.md", ["root", "a", "x"]),
		];
		const expected = ["parent", "child", "other"];
		if (sortType === "TAGGROUP_DESC") expected.reverse();
		expect(names(items.sort(grouped(sortType)))).toEqual(expected);
	});

	it.each(["TAGGROUP_ASC", "TAGGROUP_DESC"] as const)("preserves written branches when a later tag sorts before its parent in %s", (sortType) => {
		const items = [
			viewItem("b-parent.md", ["root", "b"]),
			viewItem("b-child.md", ["root", "b", "a"]),
			viewItem("a-child.md", ["root", "a", "b"]),
			viewItem("a-parent.md", ["root", "a"]),
		];
		const expected = ["a-parent", "a-child", "b-parent", "b-child"];
		if (sortType === "TAGGROUP_DESC") expected.reverse();
		expect(names(items.sort(grouped(sortType)))).toEqual(expected);
	});

	it("calculates grouping keys separately for each trail", () => {
		const item = viewItem("a.md", ["project/client", "area"]);
		expect(getTagGroups(item, [], true)).toEqual(["project/client", "area"]);
		expect(getTagGroups(item, ["project/"], true)).toEqual(["client", "area"]);
	});

	it("keeps grouping keys in written order when the comparison locale changes", () => {
		const item = viewItem("a.md", ["root", "政治", "英语"]);
		setAppLanguage("en");
		expect(getTagGroups(item, [], true)).toEqual(["root", "政治", "英语"]);
		setAppLanguage("zh-CN");
		expect(getTagGroups(item, [], true)).toEqual(["root", "政治", "英语"]);
	});

	it("binds each grouping comparator to its selected language", () => {
		const politics = viewItem("politics.md", ["政治"]);
		const english = viewItem("english.md", ["英语"]);
		setAppLanguage("en");
		const compareEnglish = grouped("TAGGROUP_ASC");
		setAppLanguage("zh-CN");
		const compareChinese = grouped("TAGGROUP_ASC");
		expect(compareEnglish(politics, english)).toBeLessThan(0);
		expect(compareChinese(politics, english)).toBeGreaterThan(0);
	});

	it("keeps items sharing a tag combination together", () => {
		const items = [
			"政治",
			"政治 英语",
			"英语",
			"政治",
			"英语",
		].map((name) => viewItem(`${name}.md`, name.split(" ")));
		const sorted = [...items].sort(grouped("TAGGROUP_ASC"));
		expect(names(sorted)).toEqual([
			"英语",
			"英语",
			"政治",
			"政治",
			"政治 英语",
		]);
	});

	it("groups by the first tag, then puts single-tag items before branching ones", () => {
		const items = [
			viewItem("a.md", ["随记", "政治", "英语"]),
			viewItem("b.md", ["随记", "经济"]),
			viewItem("c.md", ["随记", "政治"]),
			viewItem("d.md", ["随记", "政治", "经济"]),
			viewItem("e.md", ["随记"]),
		];
		const sorted = [...items].sort(grouped("TAGGROUP_ASC"));
		expect(names(sorted)).toEqual(["e", "b", "c", "d", "a"]);
	});

	it("branches on the first written tag, not on the alphabetically first one", () => {
		expect(getTagGroups(viewItem("a.md", ["政治", "随记"]), [], true)).toEqual(["政治", "随记"]);
		expect(getTagGroups(viewItem("b.md", ["随记", "政治"]), [], true)).toEqual(["随记", "政治"]);
	});

	it("keeps the full written tag sequence in the grouping key", () => {
		expect(getTagGroups(viewItem("a.md", ["root", "b", "a"]), [], true)).toEqual(["root", "b", "a"]);
		expect(getTagGroups(viewItem("b.md", ["root", "a", "b"]), [], true)).toEqual(["root", "a", "b"]);
		expect(getTagGroups(viewItem("c.md", ["_VIRTUAL_TAG_FOLDER/path", "root", "b", "a"]), [], true)).toEqual(["root", "b", "a"]);
	});

	it("ignores special tags, so virtual tags do not build new groups", () => {
		const items = [
			viewItem("b.md", ["_untagged"]),
			viewItem("a.md", ["政治", "_VIRTUAL_TAG_CANVAS"]),
			viewItem("c.md", ["政治", "_VIRTUAL_TAG_FRESHNESS/FRESHNESS_01"]),
			viewItem("d.md", ["政治", "英语"]),
			viewItem("e.md", ["随记"]),
		];
		const sorted = [...items].sort(grouped("TAGGROUP_ASC"));
		expect(names(sorted)).toEqual(["b", "e", "a", "c", "d"]);
		expect(getTagGroups(items[0], [], true)).toEqual([]);
		expect(getTagGroups(items[1], [], true)).toEqual(["政治"]);
		expect(getTagGroups(items[2], [], true)).toEqual(["政治"]);
	});

	it("puts branching items first when the order is descending", () => {
		const items = [
			viewItem("a.md", ["随记", "政治", "英语"]),
			viewItem("c.md", ["随记", "政治"]),
			viewItem("e.md", ["随记"]),
		];
		const sorted = [...items].sort(grouped("TAGGROUP_DESC"));
		expect(names(sorted)).toEqual(["a", "c", "e"]);
	});
});
