import { describe, expect, it } from "vitest";
import { renderTagFolderTemplateVariables } from "../new-note-template";

describe("renderTagFolderTemplateVariables", () => {
	it("renders TagFolder-specific variables used by new note templates", () => {
		const rendered = renderTagFolderTemplateVariables(
			[
				"expanded={{expandedTags}}",
				"list={{tagList}}",
				"path={{tagPath}}",
				"name={{tagName}}",
				"json={{tagsJson}}",
				"yaml:",
				"{{tagsYaml}}",
			].join("\n"),
			["project/client", "_VIRTUAL_TAG_FOLDER"],
			"#project/client",
		);

		expect(rendered).toContain("expanded=#project/client");
		expect(rendered).toContain("list=project/client");
		expect(rendered).toContain("path=project/client");
		expect(rendered).toContain("name=project/client");
		expect(rendered).toContain('json=["project/client"]');
		expect(rendered).toContain("  - project/client");
	});
});
