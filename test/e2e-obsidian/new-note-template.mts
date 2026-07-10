import { withObsidianPage } from "@vrtmrz/obsidian-test-session";
import {
	TAGFOLDER_PLUGIN_ID,
	startTagFolderTestSession,
	stopTagFolderTestSession,
	type TagFolderTestSession,
} from "./harness.mts";

async function verifyTemplateWorkflow(testSession: TagFolderTestSession): Promise<void> {
	await withObsidianPage(testSession.session.remoteDebuggingPort, async (page) => {
		const creation = page.evaluate(async (pluginId) => {
			const obsidianApp = (
				globalThis as typeof globalThis & {
					app?: {
						plugins?: {
							plugins?: Record<
								string,
								{
									settings: {
										newNoteTemplate: string;
										useFrontmatterTagsForNewNotes: boolean;
									};
									createNewNote(tags: string[]): Promise<void>;
								}
							>;
						};
					};
				}
			).app;
			const plugin = obsidianApp?.plugins?.plugins?.[pluginId];
			if (!plugin) throw new Error(`TagFolder is not loaded: ${pluginId}`);
			plugin.settings.newNoteTemplate = "Templates/missing";
			plugin.settings.useFrontmatterTagsForNewNotes = false;
			await plugin.createNewNote(["project/client"]);
		}, TAGFOLDER_PLUGIN_ID);

		const prompt = page.locator(".prompt").last();
		await prompt.waitFor({ state: "visible", timeout: 10_000 });
		const templateItem = prompt
			.locator(".suggestion-item")
			.filter({ hasText: "Project note" })
			.filter({ hasText: "Templates/Project note.md" });
		await templateItem.waitFor();
		await templateItem.click();
		await creation;

		const created = await page.evaluate(async () => {
			const obsidianApp = (
				globalThis as typeof globalThis & {
					app?: {
						vault?: {
							getMarkdownFiles(): Array<{ path: string }>;
							read(file: { path: string }): Promise<string>;
						};
					};
				}
			).app;
			const vault = obsidianApp?.vault;
			if (!vault) throw new Error("Obsidian Vault is unavailable");
			const file = vault.getMarkdownFiles().find((candidate) => !candidate.path.startsWith("Templates/"));
			if (!file) throw new Error("TagFolder did not create a note");
			return { path: file.path, content: await vault.read(file) };
		});

		if (created.content !== "# project/client\n\n#project/client") {
			throw new Error(`Unexpected created note ${created.path}: ${JSON.stringify(created.content)}`);
		}
	});
}

async function main(): Promise<void> {
	let testSession: TagFolderTestSession | undefined;
	try {
		testSession = await startTagFolderTestSession();
		await verifyTemplateWorkflow(testSession);
		console.log("TagFolder template selection and Vault write passed in real Obsidian");
	} finally {
		if (testSession) await stopTagFolderTestSession(testSession);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.stack : error);
	process.exit(1);
});
