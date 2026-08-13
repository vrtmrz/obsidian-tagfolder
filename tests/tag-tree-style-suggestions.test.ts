import { describe, expect, it } from "vitest";
import {
	applyTagTreeStyleSuggestion,
	findTagTreeStyleSuggestion,
	renderTagTreeStylePreview,
	TAG_TREE_STYLE_SUGGESTIONS,
} from "../tag-tree-style-suggestions";
import { DEFAULT_SETTINGS } from "../types";

describe("tag tree style suggestions", () => {
	it("defines the three distinct structures offered by the settings tab", () => {
		expect(TAG_TREE_STYLE_SUGGESTIONS.map(({ id, name }) => ({ id, name }))).toEqual([
			{ id: "simple-list", name: "Simple list" },
			{ id: "drill-down", name: "Drill-down" },
			{ id: "full-tree", name: "Full tree" },
		]);
		expect(Object.fromEntries(
			TAG_TREE_STYLE_SUGGESTIONS.map(({ id, settings }) => [id, settings]),
		)).toEqual({
			"simple-list": {
				disableNarrowingDown: true,
				disableNestedTags: false,
				hideItems: "DEDICATED_INTERMIDIATES",
				reduceNestedParent: true,
				mergeRedundantCombination: false,
				doNotSimplifyTags: false,
			},
			"drill-down": {
				disableNarrowingDown: false,
				disableNestedTags: false,
				hideItems: "ALL_EXCEPT_BOTTOM",
				reduceNestedParent: true,
				mergeRedundantCombination: false,
				doNotSimplifyTags: false,
			},
			"full-tree": {
				disableNarrowingDown: false,
				disableNestedTags: false,
				hideItems: "NONE",
				reduceNestedParent: true,
				mergeRedundantCombination: false,
				doNotSimplifyTags: false,
			},
		});
		expect(findTagTreeStyleSuggestion("missing")).toBeUndefined();
	});

	it("applies only the tag tree structure settings", () => {
		const settings = {
			...DEFAULT_SETTINGS,
			alwaysOpen: true,
			ignoreTags: "private",
			useVirtualTag: true,
		};
		const suggestion = findTagTreeStyleSuggestion("simple-list");
		expect(suggestion).toBeDefined();

		const applied = applyTagTreeStyleSuggestion(settings, suggestion!);

		expect(applied).toMatchObject({
			disableNarrowingDown: true,
			disableNestedTags: false,
			hideItems: "DEDICATED_INTERMIDIATES",
			reduceNestedParent: true,
			mergeRedundantCombination: false,
			doNotSimplifyTags: false,
			alwaysOpen: true,
			ignoreTags: "private",
			useVirtualTag: true,
		});
		expect(settings.disableNarrowingDown).toBe(false);
	});

	it("renders and clears the selected suggestion preview", () => {
		const container = window.document.createElement("div");
		const suggestion = findTagTreeStyleSuggestion("simple-list");
		expect(suggestion).toBeDefined();

		renderTagTreeStylePreview(container, suggestion);

		expect(container.hidden).toBe(false);
		expect(container.textContent).toContain("Roadmap#project/atlas#status/active");
		expect(container.querySelectorAll('.tagfolder-style-preview-sample-tag')).toHaveLength(4);
		expect(container.textContent).toContain("Rendered project branch");
		expect(container.querySelector('[role="tree"]')).not.toBeNull();
		expect(container.querySelectorAll('.tagfolder-style-preview-chip')).toHaveLength(2);
		expect(container.querySelectorAll('[aria-expanded="true"]')).toHaveLength(2);

		renderTagTreeStylePreview(container);

		expect(container.hidden).toBe(true);
		expect(container.childElementCount).toBe(0);
	});
});
