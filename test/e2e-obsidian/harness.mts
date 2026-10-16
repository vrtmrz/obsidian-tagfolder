import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
	createTemporaryVault,
	discoverObsidianCli,
	requireObsidianBinary,
	startObsidianPluginSession,
	type ObsidianPluginSession,
	type TemporaryVault,
} from "@vrtmrz/obsidian-test-session";

export const TAGFOLDER_PLUGIN_ID = "obsidian-tagfolder";

export interface TagFolderTestSession {
	readonly session: ObsidianPluginSession;
	readonly vault: TemporaryVault;
}

async function seedTemplate(vaultPath: string): Promise<void> {
	const templatesPath = join(vaultPath, "Templates");
	await mkdir(templatesPath, { recursive: true });
	await writeFile(
		join(templatesPath, "Project note.md"),
		"# {{tagName}}\n\n{{expandedTags}}",
		"utf8",
	);
}

export async function startTagFolderTestSession(): Promise<TagFolderTestSession> {
	const cli = discoverObsidianCli();
	if (!cli.binary) throw new Error(`Could not find obsidian-cli. Checked: ${cli.checked.join(", ")}`);
	const vault = await createTemporaryVault({
		prefix: "tagfolder-e2e-",
		pluginIds: [TAGFOLDER_PLUGIN_ID],
		idPrefix: "tagfolder-e2e",
	});
	try {
		await seedTemplate(vault.path);
		const session = await startObsidianPluginSession({
			binary: requireObsidianBinary(),
			cliBinary: cli.binary,
			vault,
			pluginId: TAGFOLDER_PLUGIN_ID,
			artifactRoot: resolve("."),
			startupGraceMs: Number(process.env.E2E_OBSIDIAN_STARTUP_GRACE_MS ?? 1_000),
		});
		return { session, vault };
	} catch (error) {
		await vault.dispose();
		throw error;
	}
}

export async function stopTagFolderTestSession(testSession: TagFolderTestSession): Promise<void> {
	await testSession.session.app.stop();
	await testSession.vault.dispose();
}
