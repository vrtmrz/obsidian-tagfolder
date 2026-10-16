import {
	createUiTestHarness,
	createVaultFrontmatterTestHarness,
	createVaultTextTestHarness,
} from "@vrtmrz/obsidian-plugin-kit/testing";
import { describe, expect, it } from "vitest";
import {
	chooseNewNoteTemplate,
	filterNewNoteTemplateChoices,
	NEW_NOTE_TEMPLATE_INTERACTION_ID,
	populateNewNote,
	type NewNoteTemplateChoice,
} from "../new-note-workflow";

const template: NewNoteTemplateChoice = {
	name: "Project note",
	path: "Templates/project.md",
};

describe("new-note workflow", () => {
	it("filters one captured template snapshot by name or path", () => {
		const otherTemplate: NewNoteTemplateChoice = {
			name: "Meeting note",
			path: "Templates/meetings/daily.md",
		};
		const snapshot = [template, otherTemplate];

		expect(filterNewNoteTemplateChoices(snapshot, "PROJECT")).toEqual([template]);
		expect(filterNewNoteTemplateChoices(snapshot, "meetings/")).toEqual([otherTemplate]);
		expect(snapshot).toEqual([template, otherTemplate]);
	});

	it("requests a retry without opening UI when the captured snapshot is empty", async () => {
		const ui = createUiTestHarness([]);

		await expect(chooseNewNoteTemplate(ui.ui, [])).resolves.toBeUndefined();
		ui.assertDone();
	});

	it("selects a template by identity and records its read and rendered note write", async () => {
		const ui = createUiTestHarness([
			{ kind: "pickOne", interactionId: NEW_NOTE_TEMPLATE_INTERACTION_ID, value: template },
		]);
		const vault = createVaultTextTestHarness({
			files: {
				[template.path]: "# {{tagName}}\n\n{{expandedTags}}",
				"Untitled.md": "",
			},
		});
		const frontmatter = createVaultFrontmatterTestHarness({
			files: { "Untitled.md": {} },
		});

		const selected = await chooseNewNoteTemplate(ui.ui, [template]);
		expect(selected).not.toBeUndefined();
		if (selected === undefined) throw new Error("Expected a captured template selection");
		await populateNewNote({
			vault: vault.vault,
			frontmatter: frontmatter.vault,
			notePath: "Untitled.md",
			template: selected,
			expandedTagsAll: ["project/client"],
			expandedTags: "#project/client",
			frontmatterTags: ["project/client"],
			useFrontmatterTags: false,
		});

		expect(ui.transcript).toEqual([
			{
				kind: "pickOne",
				interactionId: NEW_NOTE_TEMPLATE_INTERACTION_ID,
				options: expect.objectContaining({
					items: [template],
					placeholder: "Type to search templates...",
				}),
			},
		]);
		expect(vault.transcript).toEqual([
			{ kind: "readText", path: template.path },
			{
				kind: "modifyText",
				path: "Untitled.md",
				content: "# project/client\n\n#project/client",
			},
		]);
		expect(vault.getFile("Untitled.md")).toBe("# project/client\n\n#project/client");
		ui.assertDone();
	});

	it("falls back to appending tags when template selection is dismissed", async () => {
		const ui = createUiTestHarness([
			{ kind: "pickOne", interactionId: NEW_NOTE_TEMPLATE_INTERACTION_ID, value: null },
		]);
		const vault = createVaultTextTestHarness({ files: { "Untitled.md": "" } });
		const frontmatter = createVaultFrontmatterTestHarness({
			files: { "Untitled.md": {} },
		});

		const selected = await chooseNewNoteTemplate(ui.ui, [template]);
		expect(selected).not.toBeUndefined();
		if (selected === undefined) throw new Error("Expected a dismissed template selection");
		await populateNewNote({
			vault: vault.vault,
			frontmatter: frontmatter.vault,
			notePath: "Untitled.md",
			template: selected,
			expandedTagsAll: ["project/client"],
			expandedTags: "#project/client",
			frontmatterTags: ["project/client"],
			useFrontmatterTags: false,
		});

		expect(vault.transcript).toEqual([
			{ kind: "appendText", path: "Untitled.md", content: "#project/client" },
		]);
		ui.assertDone();
	});

	it("prepends missing frontmatter tags without issuing a text write", async () => {
		const vault = createVaultTextTestHarness({ files: { "Untitled.md": "" } });
		const frontmatter = createVaultFrontmatterTestHarness({
			files: {
				"Untitled.md": { tags: ["existing", "project/client"] },
			},
		});

		await populateNewNote({
			vault: vault.vault,
			frontmatter: frontmatter.vault,
			notePath: "Untitled.md",
			template: null,
			expandedTagsAll: ["project/client"],
			expandedTags: "#project/client",
			frontmatterTags: ["project/client", "new"],
			useFrontmatterTags: true,
		});

		expect(vault.transcript).toEqual([]);
		expect(frontmatter.transcript).toEqual([
			{
				kind: "updateFrontmatter",
				path: "Untitled.md",
				before: { tags: ["existing", "project/client"] },
				after: { tags: ["new", "existing", "project/client"] },
			},
		]);
	});

	it("propagates a Vault write failure without changing the note", async () => {
		const writeFailure = new Error("Vault write failed");
		const vault = createVaultTextTestHarness({
			files: {
				[template.path]: "# {{tagName}}",
				"Untitled.md": "Original",
			},
			onOperation: (operation) => {
				if (operation.kind === "modifyText") throw writeFailure;
			},
		});
		const frontmatter = createVaultFrontmatterTestHarness({
			files: { "Untitled.md": {} },
		});

		await expect(populateNewNote({
			vault: vault.vault,
			frontmatter: frontmatter.vault,
			notePath: "Untitled.md",
			template,
			expandedTagsAll: ["project/client"],
			expandedTags: "#project/client",
			frontmatterTags: ["project/client"],
			useFrontmatterTags: false,
		})).rejects.toBe(writeFailure);

		expect(vault.transcript).toEqual([
			{ kind: "readText", path: template.path },
			{ kind: "modifyText", path: "Untitled.md", content: "# project/client" },
		]);
		expect(vault.getFile("Untitled.md")).toBe("Original");
	});

	it("propagates a frontmatter failure without issuing a text write", async () => {
		const failure = new Error("Frontmatter write failed");
		const vault = createVaultTextTestHarness({ files: { "Untitled.md": "" } });
		const frontmatter = createVaultFrontmatterTestHarness({
			files: { "Untitled.md": { tags: ["existing"] } },
			onOperation: () => {
				throw failure;
			},
		});

		await expect(populateNewNote({
			vault: vault.vault,
			frontmatter: frontmatter.vault,
			notePath: "Untitled.md",
			template: null,
			expandedTagsAll: ["project/client"],
			expandedTags: "#project/client",
			frontmatterTags: ["project/client"],
			useFrontmatterTags: true,
		})).rejects.toBe(failure);

		expect(vault.transcript).toEqual([]);
		expect(frontmatter.getFrontmatter("Untitled.md")).toEqual({ tags: ["existing"] });
		expect(frontmatter.transcript[0]?.after).toBeNull();
	});
});
