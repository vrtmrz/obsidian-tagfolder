import { describe, expect, it } from "vitest";
import {
	buildNoteLookupItems,
	getTagCompletions,
	normaliseLookupTags,
	parseTagInput,
	rankNoteLookupItems,
	tagMatchesCondition,
	type NoteLookupPolicy,
	type NoteLookupSource,
} from "../note-lookup";

const policy: NoteLookupPolicy = {
	targetFolders: [],
	ignoreFolders: [],
	ignoreDocumentTags: [],
	ignoreTags: [],
	redirects: {},
	splitNestedTags: false,
};

function note(path: string, tags: string[], mtime = 0): NoteLookupSource {
	return {
		path,
		title: path.split("/").pop()?.replace(/\.md$/, "") ?? path,
		tags,
		mtime,
	};
}

describe("note lookup sources", () => {
	it("normalises metadata tags and applies lookup policy", () => {
		const items = buildNoteLookupItems(
			[
				note("Projects/alpha.md", ["#Project/Client", "#private"]),
				note("Projects/ignored.md", ["#skip-note", "#Project/Other"]),
				note("Archive/old.md", ["#Project/Client"]),
			],
			{
				...policy,
				targetFolders: ["Projects"],
				ignoreDocumentTags: ["skip-note"],
				ignoreTags: ["private"],
				redirects: { "project/client": "work/client" },
			},
		);

		expect(items).toEqual([
			expect.objectContaining({
				path: "Projects/alpha.md",
				tags: ["work/client"],
			}),
		]);
	});

	it("can split nested tags using the TagFolder setting", () => {
		expect(normaliseLookupTags(["#Project/Client", "#area/home"], {
			...policy,
			splitNestedTags: true,
		})).toEqual(["Project", "Client", "area", "home"]);
	});
});

describe("tag conditions", () => {
	it("parses positive and excluded completion input", () => {
		expect(parseTagInput(" #foo ")).toEqual({ excluded: false, query: "foo" });
		expect(parseTagInput("-#foo")).toEqual({ excluded: true, query: "foo" });
	});

	it("matches exact and nested tags without leaking across boundaries", () => {
		expect(tagMatchesCondition("project", "project")).toBe(true);
		expect(tagMatchesCondition("project/client", "project")).toBe(true);
		expect(tagMatchesCondition("projectile", "project")).toBe(false);
		expect(tagMatchesCondition("PROJECT/CLIENT", "project")).toBe(true);
	});

	it("offers nested parents, prioritises prefixes, and omits selected tags", () => {
		const items = buildNoteLookupItems([
			note("alpha.md", ["#project/client", "#prototype"]),
			note("beta.md", ["#project/personal"]),
			note("gamma.md", ["#area/project"]),
		], policy);

		const completions = getTagCompletions(
			items,
			[{ tag: "prototype", excluded: false }],
			"pro",
		);

		expect(completions.map((item) => [item.tag, item.noteCount])).toEqual([
			["project", 2],
			["project/client", 1],
			["project/personal", 1],
			["area/project", 1],
		]);
	});
});

describe("note ranking", () => {
	const items = buildNoteLookupItems([
		note("alpha.md", ["#foo", "#bar"], 1),
		note("beta.md", ["#foo"], 3),
		note("gamma.md", ["#bar", "#archive"], 2),
		note("folder/delta.md", ["#other"], 4),
	], policy);

	it("uses OR inclusion and sorts by the number of matching positive tags", () => {
		const ranked = rankNoteLookupItems(items, [
			{ tag: "foo", excluded: false },
			{ tag: "bar", excluded: false },
		], "");

		expect(ranked.map((item) => [item.path, item.matchCount])).toEqual([
			["alpha.md", 2],
			["beta.md", 1],
			["gamma.md", 1],
		]);
	});

	it("treats excluded tags as hard exclusions", () => {
		const ranked = rankNoteLookupItems(items, [
			{ tag: "bar", excluded: false },
			{ tag: "archive", excluded: true },
		], "");

		expect(ranked.map((item) => item.path)).toEqual(["alpha.md"]);
	});

	it("filters titles and paths fuzzily and can omit the source note", () => {
		const ranked = rankNoteLookupItems(
			items,
			[],
			"fold delta",
			{ excludedPath: "alpha.md" },
		);

		expect(ranked.map((item) => item.path)).toEqual(["folder/delta.md"]);
	});

	it("orders an empty lookup by recent modification time", () => {
		const ranked = rankNoteLookupItems(items, [], "");

		expect(ranked.map((item) => item.path)).toEqual([
			"folder/delta.md",
			"beta.md",
			"gamma.md",
			"alpha.md",
		]);
	});
});
