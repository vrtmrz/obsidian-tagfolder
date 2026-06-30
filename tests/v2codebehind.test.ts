import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type TagFolderSettings } from "../types";
import {
	collectChildren,
	collectTreeChildren,
	performSortExactFirst,
} from "../v2codebehind";
import {
	selectCompareMethodTags,
	V2FI_IDX_CHILDREN,
	V2FI_IDX_TAG,
	type V2FolderItem,
} from "../util";
import { viewItem } from "./test-utils";

const settings = {
	...DEFAULT_SETTINGS,
	sortTypeTag: "NAME_ASC",
} satisfies TagFolderSettings;

const sortFunc = selectCompareMethodTags(settings, {});

function pathsOf(child: V2FolderItem) {
	return child[V2FI_IDX_CHILDREN].map((item) => item.path);
}

function treeSummary(children: V2FolderItem[]) {
	return children.map((child) => [child[V2FI_IDX_TAG], pathsOf(child)] as const);
}

async function collectTagTree({
	tags,
	items,
	setting = {},
	isRoot = true,
	depth = 1,
	expandLimit = 0,
	trailLower = [],
	previousTrail = "",
	isSuppressibleLevel = false,
}: {
	tags: string[];
	items: ReturnType<typeof viewItem>[];
	setting?: Partial<TagFolderSettings>;
	isRoot?: boolean;
	depth?: number;
	expandLimit?: number;
	trailLower?: string[];
	previousTrail?: string;
	isSuppressibleLevel?: boolean;
}) {
	return collectTreeChildren({
		key: "test-tree",
		expandLimit,
		depth,
		tags,
		trailLower,
		_setting: { ...settings, ...setting },
		isMainTree: true,
		isSuppressibleLevel,
		viewType: "tags",
		previousTrail,
		_tagInfo: {},
		_items: items,
		linkedItems: new Map(),
		isRoot,
		sortFunc,
	});
}

describe("collectChildren", () => {
	it("collects exact tag matches without duplicating a multi-tagged item", async () => {
		const alpha = viewItem("alpha.md", ["project/client", "project/client/report"]);
		const beta = viewItem("beta.md", ["project/client/todo"]);
		const gamma = viewItem("gamma.md", ["area/home"]);

		const children = await collectChildren("", ["project/client"], {}, [alpha, beta, gamma]);

		expect(children).toHaveLength(1);
		expect(children[0][V2FI_IDX_TAG]).toBe("project/client");
		expect(children[0][V2FI_IDX_CHILDREN].map((item) => item.path)).toEqual(["alpha.md"]);
	});

	it("collects nested descendants for folder-like tag paths", async () => {
		const alpha = viewItem("alpha.md", ["project/client/report"]);
		const beta = viewItem("beta.md", ["project/client/todo"]);
		const unrelated = viewItem("unrelated.md", ["project/client-report"]);

		const children = await collectChildren("", ["project/client/"], {}, [alpha, beta, unrelated]);

		expect(children[0][V2FI_IDX_CHILDREN].map((item) => item.path)).toEqual(["alpha.md", "beta.md"]);
	});

	it("matches tags case-insensitively and de-duplicates the same item in one folder", async () => {
		const alpha = viewItem("alpha.md", ["Project/Client", "project/client"]);
		const beta = viewItem("beta.md", ["PROJECT/CLIENT"]);

		const children = await collectChildren("", ["project/client"], {}, [alpha, beta]);

		expect(pathsOf(children[0])).toEqual(["alpha.md", "beta.md"]);
	});

	it("collects a dedicated child path relative to the previous trail", async () => {
		const alpha = viewItem("alpha.md", ["project/client/report"]);
		const beta = viewItem("beta.md", ["project/client/todo"]);
		const unrelated = viewItem("unrelated.md", ["project/other/client"]);

		const children = await collectChildren("project/", ["client/"], {}, [alpha, beta, unrelated]);

		expect(pathsOf(children[0])).toEqual(["alpha.md", "beta.md"]);
	});
});

describe("collectTreeChildren", () => {
	it("suppresses children and exposes extra tags when the expand limit is reached", async () => {
		const result = await collectTreeChildren({
			key: "root",
			expandLimit: 2,
			depth: 2,
			tags: ["project/client/report", "project/client/todo"],
			trailLower: ["project/client/"],
			_setting: settings,
			isMainTree: true,
			isSuppressibleLevel: false,
			viewType: "tags",
			previousTrail: "",
			_tagInfo: {},
			_items: [],
			linkedItems: new Map(),
			isRoot: false,
			sortFunc,
		});

		expect(result.children).toEqual([]);
		expect(result.suppressLevels).toEqual(["report", "todo"]);
	});

	it("uses the non-reduced trail mode when expand limit suppresses nested combinations", async () => {
		const result = await collectTagTree({
			tags: ["project/client/report", "project/client/todo"],
			items: [],
			expandLimit: 2,
			depth: 2,
			trailLower: ["project/", "project/client/"],
			setting: { reduceNestedParent: false },
		});

		expect(result.children).toEqual([]);
		expect(result.suppressLevels).toEqual(["report", "project/client/todo"]);
	});

	it("does not collect children when the level is suppressible", async () => {
		const result = await collectTagTree({
			tags: ["project/client/report", "project/client/todo"],
			items: [],
			trailLower: ["project/client/"],
			isSuppressibleLevel: true,
		});

		expect(result.children).toEqual([]);
		expect(result.suppressLevels).toEqual(["report", "todo"]);
	});

	it("keeps overlapping exact, parent, and child tag memberships separate by default", async () => {
		const parentOnly = viewItem("parent-only.md", ["project"]);
		const exactChild = viewItem("exact-child.md", ["project/client"]);
		const descendant = viewItem("descendant.md", ["project/client/report"]);
		const multiTagged = viewItem("multi.md", ["project", "area/home"]);

		const result = await collectTagTree({
			tags: ["area/home", "project", "project/client", "project/client/"],
			items: [parentOnly, exactChild, descendant, multiTagged],
		});

		expect(treeSummary(result.children)).toEqual([
			["project/client", ["exact-child.md"]],
			["project/client/", ["exact-child.md", "descendant.md"]],
			["area/home", ["multi.md"]],
			["project", ["parent-only.md", "multi.md"]],
		]);
	});

	it("merges redundant combinations so each item appears under the first matching child", async () => {
		const alpha = viewItem("alpha.md", ["project", "project/client"]);
		const beta = viewItem("beta.md", ["project/client"]);

		const result = await collectTagTree({
			tags: ["project", "project/client"],
			items: [alpha, beta],
			setting: { mergeRedundantCombination: true },
		});

		expect(treeSummary(result.children)).toEqual([
			["project/client", ["beta.md"]],
			["project", ["alpha.md"]],
		]);
	});

	it("preserves duplicate appearances across matching folders when redundant merging is disabled", async () => {
		const alpha = viewItem("alpha.md", ["project", "project/client"]);
		const beta = viewItem("beta.md", ["project/client"]);

		const result = await collectTagTree({
			tags: ["project", "project/client"],
			items: [alpha, beta],
			setting: { mergeRedundantCombination: false },
		});

		expect(treeSummary(result.children)).toEqual([
			["project/client", ["alpha.md", "beta.md"]],
			["project", ["alpha.md"]],
		]);
	});

	it("filters archived items from the root tree but keeps the archive branch", async () => {
		const active = viewItem("active.md", ["project"]);
		const archived = viewItem("archived.md", ["archive", "project"]);

		const result = await collectTagTree({
			tags: ["archive", "project"],
			items: [active, archived],
			setting: { archiveTags: "archive" },
		});

		expect(treeSummary(result.children)).toEqual([
			["archive", ["archived.md"]],
			["project", ["active.md"]],
		]);
	});

	it("keeps non-root archive filtering disabled so nested levels can show their local items", async () => {
		const archived = viewItem("archived.md", ["archive", "project"]);

		const result = await collectTagTree({
			tags: ["archive", "project"],
			items: [archived],
			setting: { archiveTags: "archive" },
			isRoot: false,
		});

		expect(treeSummary(result.children)).toEqual([
			["archive", ["archived.md"]],
			["project", ["archived.md"]],
		]);
	});

	it("keeps descendant archive branches visible while hiding archived notes from unrelated root folders", async () => {
		const active = viewItem("active.md", ["project"]);
		const archived = viewItem("archived.md", ["archive/done", "project"]);

		const result = await collectTagTree({
			tags: ["archive/", "project"],
			items: [active, archived],
			setting: { archiveTags: "archive/done" },
		});

		expect(treeSummary(result.children)).toEqual([
			["archive/", ["archived.md"]],
			["project", ["active.md"]],
		]);
	});
});

describe("performSortExactFirst", () => {
	it("keeps exact matches before items that only appear in child folders", () => {
		const exact = viewItem("exact.md", ["project"]);
		const nested = viewItem("nested.md", ["project/client"]);
		const child: V2FolderItem = ["project/client", "client", ["client"], [nested]];

		const result = performSortExactFirst([exact], [child], [nested, exact]);

		expect(result.map((item) => item.path)).toEqual(["exact.md", "nested.md"]);
	});
});
