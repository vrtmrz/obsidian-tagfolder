import { describe, expect, it } from "vitest";
import { isVisibleInArchiveBranch, parseTagFilterPatterns, tagMatchesFilterPatterns } from "../tag-filters";

describe("tag filter patterns", () => {
	it("keeps plain entries exact and accepts hashes, whitespace, and case differences", () => {
		const patterns = parseTagFilterPatterns(" #Project, ,\n #Private/* ");
		expect(tagMatchesFilterPatterns("#PROJECT", patterns)).toBe(true);
		expect(tagMatchesFilterPatterns("project/client", patterns)).toBe(false);
		expect(tagMatchesFilterPatterns("private/client/draft", patterns)).toBe(true);
		expect(tagMatchesFilterPatterns("private", patterns)).toBe(false);
		expect(tagMatchesFilterPatterns("private-other/client", patterns)).toBe(false);
	});

	it.each(["project/client/done", "project/client/stage/done"])("matches multi-level glob text in %s", (tag) => {
		expect(tagMatchesFilterPatterns(tag, parseTagFilterPatterns("project/*/done"))).toBe(true);
	});

	it("anchors glob matches and treats regular-expression characters literally", () => {
		const patterns = parseTagFilterPatterns("project.+/*");
		expect(tagMatchesFilterPatterns("project.+/done", patterns)).toBe(true);
		expect(tagMatchesFilterPatterns("project/client/done", patterns)).toBe(false);
		expect(tagMatchesFilterPatterns("other/project.+/done", patterns)).toBe(false);
	});

	it("matches nothing when the filter is empty", () => {
		expect(tagMatchesFilterPatterns("project", parseTagFilterPatterns(" , \n,"))).toBe(false);
	});

	it("can match a parent and its descendants without matching a similar prefix", () => {
		const patterns = parseTagFilterPatterns("project,project/*");
		expect(tagMatchesFilterPatterns("project", patterns)).toBe(true);
		expect(tagMatchesFilterPatterns("project/client", patterns)).toBe(true);
		expect(tagMatchesFilterPatterns("projectile/client", patterns)).toBe(false);
	});
});

describe("archive branches", () => {
	it("keeps every branch when none of the note's tags are archived", () => {
		expect(isVisibleInArchiveBranch(["project"], "project", parseTagFilterPatterns("archive/*"))).toBe(true);
	});

	it("uses full matching tags to distinguish branches that share a pattern prefix", () => {
		const patterns = parseTagFilterPatterns("arch*/done");
		const tags = ["archive/done", "archaeology"];
		expect(isVisibleInArchiveBranch(tags, "#ARCHIVE/", patterns)).toBe(true);
		expect(isVisibleInArchiveBranch(tags, "archaeology", patterns)).toBe(false);
	});

	it("keeps each matching archive branch and respects tag path boundaries", () => {
		const patterns = parseTagFilterPatterns("*/done");
		const tags = ["archive/done", "retired/done", "arch", "project"];
		expect(isVisibleInArchiveBranch(tags, "archive", patterns)).toBe(true);
		expect(isVisibleInArchiveBranch(tags, "retired", patterns)).toBe(true);
		expect(isVisibleInArchiveBranch(tags, "arch", patterns)).toBe(false);
		expect(isVisibleInArchiveBranch(tags, "project", patterns)).toBe(false);
	});
});
