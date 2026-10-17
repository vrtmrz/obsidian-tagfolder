import type { TagFolderSettings } from "./types";
import { tr } from "./i18n";

export type TagTreeStyleSuggestionId = "simple-list" | "drill-down" | "full-tree";

export interface TagTreeStylePreviewNode {
	label: string;
	kind: "tag" | "note";
	chips?: readonly string[];
	children?: readonly TagTreeStylePreviewNode[];
}

export interface TagTreeStyleSuggestion {
	id: TagTreeStyleSuggestionId;
	name: string;
	description: string;
	settings: Readonly<Partial<TagFolderSettings>>;
	preview: readonly TagTreeStylePreviewNode[];
}

const SAMPLE_NOTES = [
	{ name: "Roadmap", tags: ["project/atlas", "status/active"] },
	{ name: "Release note", tags: ["project/atlas", "status/done"] },
] as const;

const projectTag = (children: readonly TagTreeStylePreviewNode[]): TagTreeStylePreviewNode => ({
	label: "project",
	kind: "tag",
	children: [{ label: "atlas", kind: "tag", children }],
});

export const TAG_TREE_STYLE_SUGGESTIONS: readonly TagTreeStyleSuggestion[] = [
	{
		id: "simple-list",
		name: "Simple list",
		description: "Show notes directly beneath each tag and display their other tags as labels.",
		settings: {
			disableNarrowingDown: true,
			disableNestedTags: false,
			hideItems: "DEDICATED_INTERMIDIATES",
			reduceNestedParent: true,
			mergeRedundantCombination: false,
			doNotSimplifyTags: false,
		},
		preview: [
			projectTag([
				{ label: "Roadmap", kind: "note", chips: ["status/active"] },
				{ label: "Release note", kind: "note", chips: ["status/done"] },
			]),
		],
	},
	{
		id: "drill-down",
		name: "Drill-down",
		description: "Use other tags as additional folders and show notes at the deepest matching level.",
		settings: {
			disableNarrowingDown: false,
			disableNestedTags: false,
			hideItems: "ALL_EXCEPT_BOTTOM",
			reduceNestedParent: true,
			mergeRedundantCombination: false,
			doNotSimplifyTags: false,
		},
		preview: [
			projectTag([
				{
					label: "status",
					kind: "tag",
					children: [
						{
							label: "active",
							kind: "tag",
							children: [{ label: "Roadmap", kind: "note" }],
						},
						{
							label: "done",
							kind: "tag",
							children: [{ label: "Release note", kind: "note" }],
						},
					],
				},
			]),
		],
	},
	{
		id: "full-tree",
		name: "Full tree",
		description: "Show notes at intermediate levels as well as within combinations of their tags.",
		settings: {
			disableNarrowingDown: false,
			disableNestedTags: false,
			hideItems: "NONE",
			reduceNestedParent: true,
			mergeRedundantCombination: false,
			doNotSimplifyTags: false,
		},
		preview: [
			projectTag([
				{ label: "Roadmap", kind: "note" },
				{ label: "Release note", kind: "note" },
				{
					label: "status",
					kind: "tag",
					children: [
						{
							label: "active",
							kind: "tag",
							children: [{ label: "Roadmap", kind: "note" }],
						},
						{
							label: "done",
							kind: "tag",
							children: [{ label: "Release note", kind: "note" }],
						},
					],
				},
			]),
		],
	},
];

export function findTagTreeStyleSuggestion(id: string): TagTreeStyleSuggestion | undefined {
	return TAG_TREE_STYLE_SUGGESTIONS.find((suggestion) => suggestion.id === id);
}

export function applyTagTreeStyleSuggestion(
	settings: TagFolderSettings,
	suggestion: TagTreeStyleSuggestion,
): TagFolderSettings {
	return { ...settings, ...suggestion.settings };
}

function appendPreviewNodes(
	container: HTMLElement,
	nodes: readonly TagTreeStylePreviewNode[],
): void {
	for (const node of nodes) {
		const nodeEl = container.createDiv({ cls: `tagfolder-style-preview-node is-${node.kind}` });
		nodeEl.setAttribute("role", "treeitem");

		const rowEl = nodeEl.createDiv({ cls: "tagfolder-style-preview-row" });
		const markerEl = rowEl.createSpan({ cls: "tagfolder-style-preview-marker" });
		markerEl.setAttribute("aria-hidden", "true");
		markerEl.textContent = node.kind === "tag" ? "▾" : "•";

		rowEl.createSpan({ cls: "tagfolder-style-preview-node-label", text: node.label });

		for (const chip of node.chips ?? []) {
			rowEl.createSpan({ cls: "tagfolder-style-preview-chip", text: chip });
		}

		if (node.children?.length) {
			nodeEl.setAttribute("aria-expanded", "true");
			const childrenEl = nodeEl.createDiv({ cls: "tagfolder-style-preview-children" });
			childrenEl.setAttribute("role", "group");
			appendPreviewNodes(childrenEl, node.children);
		}
	}
}

export function renderTagTreeStylePreview(
	container: HTMLElement,
	suggestion?: TagTreeStyleSuggestion,
): void {
	container.replaceChildren();
	container.hidden = !suggestion;
	container.setAttribute("aria-live", "polite");
	if (!suggestion) return;

	container.createDiv({ cls: "tagfolder-style-preview-description", text: tr(suggestion.description) });
	container.createDiv({ cls: "tagfolder-style-preview-label", text: tr("Sample notes") });

	const sampleEl = container.createDiv({ cls: "tagfolder-style-preview-sample" });
	for (const note of SAMPLE_NOTES) {
		const noteEl = sampleEl.createDiv({ cls: "tagfolder-style-preview-sample-note" });
		noteEl.createSpan({ cls: "tagfolder-style-preview-sample-name", text: note.name });
		const tagsEl = noteEl.createSpan({ cls: "tagfolder-style-preview-sample-tags" });
		for (const tag of note.tags) {
			tagsEl.createSpan({ cls: "tagfolder-style-preview-sample-tag", text: `#${tag}` });
		}
	}

	container.createDiv({ cls: "tagfolder-style-preview-label", text: tr("Rendered project branch") });

	const treeEl = container.createDiv({ cls: "tagfolder-style-preview-tree" });
	treeEl.setAttribute("role", "tree");
	appendPreviewNodes(treeEl, suggestion.preview);
}
