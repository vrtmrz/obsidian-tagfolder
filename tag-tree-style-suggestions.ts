import type { TagFolderSettings } from "./types";

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
	document: Document,
	container: HTMLElement,
	nodes: readonly TagTreeStylePreviewNode[],
): void {
	for (const node of nodes) {
		const nodeEl = document.createElement("div");
		nodeEl.className = `tagfolder-style-preview-node is-${node.kind}`;
		nodeEl.setAttribute("role", "treeitem");

		const rowEl = document.createElement("div");
		rowEl.className = "tagfolder-style-preview-row";
		const markerEl = document.createElement("span");
		markerEl.className = "tagfolder-style-preview-marker";
		markerEl.setAttribute("aria-hidden", "true");
		markerEl.textContent = node.kind === "tag" ? "▾" : "•";
		rowEl.append(markerEl);

		const labelEl = document.createElement("span");
		labelEl.className = "tagfolder-style-preview-node-label";
		labelEl.textContent = node.label;
		rowEl.append(labelEl);

		for (const chip of node.chips ?? []) {
			const chipEl = document.createElement("span");
			chipEl.className = "tagfolder-style-preview-chip";
			chipEl.textContent = chip;
			rowEl.append(chipEl);
		}
		nodeEl.append(rowEl);

		if (node.children?.length) {
			nodeEl.setAttribute("aria-expanded", "true");
			const childrenEl = document.createElement("div");
			childrenEl.className = "tagfolder-style-preview-children";
			childrenEl.setAttribute("role", "group");
			appendPreviewNodes(document, childrenEl, node.children);
			nodeEl.append(childrenEl);
		}
		container.append(nodeEl);
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

	const document = container.ownerDocument;
	const descriptionEl = document.createElement("div");
	descriptionEl.className = "tagfolder-style-preview-description";
	descriptionEl.textContent = suggestion.description;
	container.append(descriptionEl);

	const sampleLabelEl = document.createElement("div");
	sampleLabelEl.className = "tagfolder-style-preview-label";
	sampleLabelEl.textContent = "Sample notes";
	container.append(sampleLabelEl);

	const sampleEl = document.createElement("div");
	sampleEl.className = "tagfolder-style-preview-sample";
	for (const note of SAMPLE_NOTES) {
		const noteEl = document.createElement("div");
		noteEl.className = "tagfolder-style-preview-sample-note";
		const nameEl = document.createElement("span");
		nameEl.className = "tagfolder-style-preview-sample-name";
		nameEl.textContent = note.name;
		const tagsEl = document.createElement("span");
		tagsEl.className = "tagfolder-style-preview-sample-tags";
		for (const tag of note.tags) {
			const tagEl = document.createElement("span");
			tagEl.className = "tagfolder-style-preview-sample-tag";
			tagEl.textContent = `#${tag}`;
			tagsEl.append(tagEl);
		}
		noteEl.append(nameEl, tagsEl);
		sampleEl.append(noteEl);
	}
	container.append(sampleEl);

	const treeLabelEl = document.createElement("div");
	treeLabelEl.className = "tagfolder-style-preview-label";
	treeLabelEl.textContent = "Rendered project branch";
	container.append(treeLabelEl);

	const treeEl = document.createElement("div");
	treeEl.className = "tagfolder-style-preview-tree";
	treeEl.setAttribute("role", "tree");
	appendPreviewNodes(document, treeEl, suggestion.preview);
	container.append(treeEl);
}
