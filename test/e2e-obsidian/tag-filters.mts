import assert from "node:assert/strict";
import { withObsidianPage } from "@vrtmrz/obsidian-test-session";
import type { Locator, Page } from "playwright";
import {
	TAGFOLDER_PLUGIN_ID,
	startTagFolderTestSession,
	stopTagFolderTestSession,
	type TagFolderTestSession,
} from "./harness.mts";

interface FilterTestApp {
	plugins: { plugins: Record<string, {
		settings: Record<string, unknown>;
		saveSettings(): Promise<void>;
		loadData(): Promise<Record<string, unknown>>;
		loadFileInfoAsync(): Promise<void>;
		activateView(): Promise<void>;
	}> };
	vault: {
		create(path: string, content: string): Promise<unknown>;
		getAbstractFileByPath(path: string): unknown;
	};
	metadataCache: { getFileCache(file: unknown): {
		tags?: unknown[];
		frontmatter?: { tags?: unknown[] };
	} | null };
	setting: { open(): void; openTabById(id: string): void; close(): void };
	commands: { executeCommandById(id: string): boolean };
	workspace: {
		leftSplit: { expand(): void };
		getLeavesOfType(type: string): Array<{ detach(): void }>;
		revealLeaf(leaf: { detach(): void }): Promise<void>;
		openLinkText(path: string, sourcePath: string): Promise<void>;
	};
}

type FilterWindow = typeof globalThis & { app: FilterTestApp };

const TREE = '.workspace-leaf-content:has(.mod-root > .nav-folder-title > .nav-folder-title-content:text-matches("^Tags:"))';
const LIST = '.workspace-leaf-content[data-type="tagfolder-view-list"]';
const MODAL = ".tagfolder-note-lookup-modal";
const NOTES = [
	["Active project.md", "#project"],
	["Archived project.md", "---\ntags: [archive/done, project]\n---\n"],
	["Active archaeology.md", "#archaeology"],
	["Archived archaeology.md", "#archive/done #archaeology"],
	["Private parent.md", "#private #project"],
	["Private child.md", "#private/client #project"],
	["Hidden tags.md", "#hidden/client #exact/child #project"],
	["Similar source.md", "#private/client #hidden/client #exact/child #project"],
] as const;

async function seedNotes(page: Page): Promise<void> {
	await page.evaluate(async ({ pluginId, notes }) => {
		const app = (globalThis as FilterWindow).app;
		const plugin = app.plugins.plugins[pluginId];
		Object.assign(plugin.settings, {
			ignoreDocTags: "", ignoreTags: "", archiveTags: "",
			doNotSimplifyTags: true, hideItems: "NONE", useMultiPaneList: false,
			// The context menu exposes Open list when tag information is enabled.
			useTagInfo: true,
			disableNarrowingDown: false, disableNestedTags: false, showListIn: "SPLIT_PANE",
		});
		await plugin.saveSettings();
		for (const [path, content] of notes) await app.vault.create(path, content);
	}, { pluginId: TAGFOLDER_PLUGIN_ID, notes: NOTES });
	await page.waitForFunction((paths) => {
		const app = (globalThis as FilterWindow).app;
		return paths.every((path) => {
			const file = app.vault.getAbstractFileByPath(path);
			if (file == null) return false;
			const cache = app.metadataCache.getFileCache(file);
			return cache && ((cache.tags?.length ?? 0) + (cache.frontmatter?.tags?.length ?? 0)) > 0;
		});
	}, NOTES.map(([path]) => path), { timeout: 10_000 });
	await page.evaluate(async (pluginId) => {
		const app = (globalThis as FilterWindow).app;
		await app.plugins.plugins[pluginId].loadFileInfoAsync();
		await app.plugins.plugins[pluginId].activateView();
		app.workspace.leftSplit.expand();
		await app.workspace.revealLeaf(app.workspace.getLeavesOfType("tagfolder-view")[0]);
	}, TAGFOLDER_PLUGIN_ID);
	await page.locator(TREE).waitFor({ state: "visible" });
}

async function setFilter(page: Page, name: string, key: string, value: string): Promise<void> {
	await page.evaluate((pluginId) => {
		const setting = (globalThis as FilterWindow).app.setting;
		setting.open();
		setting.openTabById(pluginId);
	}, TAGFOLDER_PLUGIN_ID);
	const setting = page.locator(".setting-item").filter({
		has: page.locator(".setting-item-name").filter({ hasText: new RegExp(`^${name}$`) }),
	});
	await setting.locator("textarea").fill(value);
	await page.waitForFunction(async ({ pluginId, key, value }) => {
		const plugin = (globalThis as FilterWindow).app.plugins.plugins[pluginId];
		return plugin.settings[key] === value && (await plugin.loadData())[key] === value;
	}, { pluginId: TAGFOLDER_PLUGIN_ID, key, value }, { timeout: 10_000 });
	await page.evaluate(() => (globalThis as FilterWindow).app.setting.close());
}

async function expectValues(
	page: Page, scope: Locator, selector: string, expected: string[], attribute?: string,
): Promise<void> {
	const sorted = [...expected].sort();
	const deadline = Date.now() + 10_000;
	await scope.waitFor({ state: "visible" });
	while (true) {
		const actual = await scope.locator(selector).evaluateAll((elements, attribute) => elements.map((element) =>
			attribute ? element.getAttribute(attribute) : element.textContent?.trim(),
		), attribute);
		if (JSON.stringify([...new Set(actual)].sort()) === JSON.stringify(sorted)) return;
		if (Date.now() >= deadline) {
			throw new Error(`Unexpected ${selector}: expected=${JSON.stringify(sorted)}, actual=${JSON.stringify(actual)}`);
		}
		await page.waitForTimeout(100);
	}
}

function branchTitle(page: Page, tag: string): Locator {
	return page.locator(TREE).locator(".mod-root > .nav-folder > .tag-folder-title").filter({
		has: page.locator(".tagfolder-titletagname").filter({ hasText: new RegExp(`^${tag}$`) }),
	});
}

async function expectBranch(page: Page, tag: string, paths: string[]): Promise<void> {
	const title = branchTitle(page, tag);
	await title.waitFor({ state: "visible" });
	const branch = title.locator("..");
	if (await branch.evaluate((element) => element.classList.contains("is-collapsed"))) {
		await title.locator(".tagfolder-titletagname").click();
	}
	await expectValues(page, branch, ".nav-file-title", paths, "data-path");
}

async function expectList(page: Page, tag: string, paths: string[]): Promise<void> {
	await branchTitle(page, tag).locator(".tagfolder-titletagname").click({ button: "right" });
	await page.locator(".menu").getByText("Open list", { exact: true }).click();
	const list = page.locator(LIST);
	await list.waitFor({ state: "visible" });
	await expectValues(page, list, ".nav-file-title", paths, "data-path");
	await page.evaluate(() => {
		for (const leaf of (globalThis as FilterWindow).app.workspace.getLeavesOfType("tagfolder-view-list")) leaf.detach();
	});
}

async function openLookup(page: Page, similar = false): Promise<Locator> {
	const command = similar ? "tagfolder-open-note-with-similar-tags" : "tagfolder-open-note-by-tags";
	assert.ok(await page.evaluate((id) => (globalThis as FilterWindow).app.commands.executeCommandById(id),
		`${TAGFOLDER_PLUGIN_ID}:${command}`), `Command was unavailable: ${command}`);
	const modal = page.locator(MODAL);
	await modal.waitFor({ state: "visible" });
	return modal;
}

async function verifyArchiveRouting(page: Page): Promise<void> {
	const activeProject = ["Active project.md", "Private parent.md", "Private child.md", "Hidden tags.md", "Similar source.md"];
	await expectBranch(page, "project", [...activeProject, "Archived project.md"]);
	for (const pattern of ["*/done", "arch*/done"]) {
		await setFilter(page, "Archive tags", "archiveTags", pattern);
		await expectBranch(page, "project", activeProject);
		await expectBranch(page, "archaeology", ["Active archaeology.md"]);
		await expectBranch(page, "archive", ["Archived project.md", "Archived archaeology.md"]);
		await expectList(page, "project", activeProject);
		await expectList(page, "archive", ["Archived project.md", "Archived archaeology.md"]);
		console.log(`Verified archive tree and lists: ${pattern}`);
	}
}

async function verifyIgnoredTags(page: Page): Promise<void> {
	await setFilter(page, "Archive tags", "archiveTags", "");
	await setFilter(page, "Ignore Tag", "ignoreTags", "hidden/*,exact");
	for (const [pattern, privateNotes] of [
		["private", ["Private child", "Similar source"]],
		["private/*", ["Private parent"]],
		["private,private/*", []],
	] as const) {
		await setFilter(page, "Ignore note Tag", "ignoreDocTags", pattern);
		await expectBranch(page, "project", [
			"Active project.md", "Archived project.md", "Hidden tags.md",
			...privateNotes.map((name) => `${name}.md`),
		]);
		assert.equal(await branchTitle(page, "hidden").count(), 0, "A glob-hidden tag remained in the tree");
		await branchTitle(page, "exact").waitFor({ state: "visible" });

		const modal = await openLookup(page);
		await modal.locator("#tagfolder-note-lookup-note-input").fill("Private");
		await expectValues(page, modal, ".note-result .note-file-name",
			privateNotes.filter((name) => name.startsWith("Private")).map((name) => `${name}.md`));
		const input = modal.locator("#tagfolder-note-lookup-tag-input");
		await input.fill("hidden");
		await expectValues(page, modal, ".completion > span:first-child", []);
		await input.fill("exact");
		// A retained child also supplies its parent as a lookup completion.
		await expectValues(page, modal, ".completion > span:first-child", ["#exact", "#exact/child"]);
		await input.fill("");
		await input.press("Escape");
		await modal.waitFor({ state: "hidden" });
		console.log(`Verified ignored-note tree and lookup: ${pattern}`);
	}
}

async function verifySimilarNoteConditions(page: Page): Promise<void> {
	await page.evaluate(async () => {
		await (globalThis as FilterWindow).app.workspace.openLinkText("Similar source.md", "");
	});
	const modal = await openLookup(page, true);
	await expectValues(page, modal, ".tag-chip .multi-select-pill-content", ["#exact/child", "#project"]);
	await modal.locator(".note-result").filter({ hasText: "Hidden tags" }).waitFor({ state: "visible" });
	assert.equal(await modal.locator(".note-result").filter({ hasText: "Similar source" }).count(), 0);
	assert.equal(await modal.locator(".note-tags > span").filter({ hasText: /^#hidden\// }).count(), 0);
	await modal.locator("#tagfolder-note-lookup-tag-input").press("Escape");
	console.log("Verified glob filters in similar-note initial conditions");
}

async function main(): Promise<void> {
	let testSession: TagFolderTestSession | undefined;
	try {
		testSession = await startTagFolderTestSession("tagfolder-filters-e2e-");
		await withObsidianPage(testSession.session.remoteDebuggingPort, async (page) => {
			const pageErrors: string[] = [];
			page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));
			try {
				await page.setViewportSize({ width: 1280, height: 960 });
				await seedNotes(page);
				await verifyArchiveRouting(page);
				await verifyIgnoredTags(page);
				await verifySimilarNoteConditions(page);
				assert.deepEqual(pageErrors, [], "Unexpected Obsidian renderer errors");
			} catch (error) {
				console.error({ pageErrors, treeViews: await page.locator(TREE).evaluateAll((elements) => elements.map((element) => ({
					html: element.outerHTML.slice(0, 2_000),
					width: element.getBoundingClientRect().width,
					height: element.getBoundingClientRect().height,
				}))) });
				throw error;
			}
		});
		console.log("TagFolder tag filters passed in real Obsidian");
	} catch (error) {
		if (testSession) console.error(testSession.session.app.output());
		throw error;
	} finally {
		if (testSession) await stopTagFolderTestSession(testSession);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.stack : error);
	process.exit(1);
});
