import { describe, expect, it } from "vitest";
import {
	DEFAULT_SETTINGS,
	type TagFolderSettings,
} from "../types";
import {
	getExtraTags,
	parseTagName,
	pathMatch,
	removeIntermediatePath,
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
