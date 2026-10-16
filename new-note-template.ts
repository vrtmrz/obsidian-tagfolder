import { isSpecialTag } from "./util";

export function renderTagFolderTemplateVariables(template: string, expandedTagsAll: string[], expandedTags: string) {
	const plainTags = expandedTagsAll.filter(e => !isSpecialTag(e));
	const replacements: Record<string, string> = {
		expandedTags,
		tags: expandedTags,
		tagList: plainTags.join(", "),
		tagPath: plainTags.join("/"),
		tagName: plainTags[plainTags.length - 1] ?? "",
		tagsJson: JSON.stringify(plainTags),
		tagsYaml: plainTags.map((tag) => `  - ${tag}`).join("\n"),
	};

	return template.replace(/\{\{(expandedTags|tags|tagList|tagPath|tagName|tagsJson|tagsYaml)\}\}/g, (_, key: keyof typeof replacements) => replacements[key]);
}
