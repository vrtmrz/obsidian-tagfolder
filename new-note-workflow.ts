import type { UiInteractions } from "@vrtmrz/obsidian-plugin-kit/ui";
import type { VaultTextAccess } from "@vrtmrz/obsidian-plugin-kit/vault";
import { renderTagFolderTemplateVariables } from "./new-note-template";

export const NEW_NOTE_TEMPLATE_INTERACTION_ID = "new-note-template";

/** Template identity and labels exposed to the application workflow. */
export interface NewNoteTemplateChoice {
	/** Vault-relative template path. */
	readonly path: string;
	/** Primary visible template name. */
	readonly name: string;
}

/** Requests one template by identity, or returns `null` when dismissed or empty. */
export async function chooseNewNoteTemplate(
	ui: UiInteractions,
	templates: readonly NewNoteTemplateChoice[],
): Promise<NewNoteTemplateChoice | null> {
	if (templates.length == 0) return null;
	return await ui.pickOne(
		{
			items: templates,
			getText: (template) => template.name,
			getDescription: (template) => template.path,
			placeholder: "Type to search templates...",
		},
		NEW_NOTE_TEMPLATE_INTERACTION_ID,
	);
}

/** Inputs owned by TagFolder while populating a newly created note. */
export interface PopulateNewNoteOptions {
	/** Injectable path-based Vault text capability. */
	readonly vault: VaultTextAccess;
	/** Vault-relative path of the already created note. */
	readonly notePath: string;
	/** Selected template, or `null` to apply tags without a template. */
	readonly template: NewNoteTemplateChoice | null;
	/** Expanded tags used by template variables. */
	readonly expandedTagsAll: readonly string[];
	/** Expanded hashtag string used by template variables or body append. */
	readonly expandedTags: string;
	/** Non-special tags supplied to the frontmatter callback. */
	readonly frontmatterTags: readonly string[];
	/** Whether no-template tags should be written through frontmatter. */
	readonly useFrontmatterTags: boolean;
	/** Consumer-owned Obsidian frontmatter mutation. */
	readonly applyFrontmatterTags: (tags: readonly string[]) => Promise<void>;
}

/** Populates a new note from a template, frontmatter tags, or appended hashtags. */
export async function populateNewNote(options: PopulateNewNoteOptions): Promise<void> {
	if (options.template !== null) {
		const template = await options.vault.readText(options.template.path);
		const renderedTemplate = renderTagFolderTemplateVariables(
			template,
			[...options.expandedTagsAll],
			options.expandedTags,
		);
		if (renderedTemplate.trim() != "") {
			await options.vault.modifyText(options.notePath, renderedTemplate);
		}
		return;
	}

	if (options.useFrontmatterTags) {
		await options.applyFrontmatterTags(options.frontmatterTags);
		return;
	}

	await options.vault.appendText(options.notePath, options.expandedTags);
}
