import type { UiInteractions } from "@vrtmrz/obsidian-plugin-kit/ui";
import type { VaultTextAccess } from "@vrtmrz/obsidian-plugin-kit/vault";
import { renderTagFolderTemplateVariables } from "./new-note-template";

export const NEW_NOTE_TEMPLATE_INTERACTION_ID = "new-note-template";

/** UI capability required by the new-note template workflow. */
export type NewNoteTemplateUi = Pick<UiInteractions, "pickOne">;

/** Vault text capability required while populating a new note. */
export type NewNoteVaultTextAccess = Pick<
	VaultTextAccess,
	"readText" | "modifyText" | "appendText"
>;

/** Template identity and labels exposed to the application workflow. */
export interface NewNoteTemplateChoice {
	/** Vault-relative template path. */
	readonly path: string;
	/** Primary visible template name. */
	readonly name: string;
}

/** Filters one captured template snapshot by name or Vault-relative path. */
export function filterNewNoteTemplateChoices(
	templates: readonly NewNoteTemplateChoice[],
	query: string,
): NewNoteTemplateChoice[] {
	const normalizedQuery = query.toLowerCase();
	return templates.filter((template) =>
		template.path.toLowerCase().includes(normalizedQuery)
		|| template.name.toLowerCase().includes(normalizedQuery)
	);
}

/** Requests one captured template by identity, returns `null` when dismissed, or `undefined` when empty. */
export async function chooseNewNoteTemplate(
	ui: NewNoteTemplateUi,
	templates: readonly NewNoteTemplateChoice[],
): Promise<NewNoteTemplateChoice | null | undefined> {
	if (templates.length == 0) return undefined;
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
	readonly vault: NewNoteVaultTextAccess;
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
