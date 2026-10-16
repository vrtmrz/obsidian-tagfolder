import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { waitForObsidianPageUiIdle, withObsidianPage } from "@vrtmrz/obsidian-test-session";
import type { Locator, Page } from "playwright";
import {
	TAGFOLDER_PLUGIN_ID,
	startTagFolderTestSession,
	stopTagFolderTestSession,
	type TagFolderTestSession,
} from "./harness.mts";

type LanguagePreference = "auto" | "en" | "zh-CN";
type AppLanguage = "ja" | "zh" | "zh-TW";

interface TagFolderE2EPlugin {
	settings: {
		uiLanguage: LanguagePreference;
		sortType: string;
		useMultiPaneList: boolean;
	};
	allViewItems: Array<{ path: string; tags: string[]; extraTags: string[] }>;
	loadFileInfoAsync(): Promise<void>;
	saveSettings(): Promise<void>;
	openListView(tags: string[]): Promise<void>;
	activateView(): Promise<void>;
}

interface ObsidianE2EApp {
	plugins: { plugins: Record<string, TagFolderE2EPlugin> };
	setting: { open(): void; close(): void; openTabById(id: string): unknown };
	vault: {
		createFolder(path: string): Promise<unknown>;
		create(path: string, content: string): Promise<unknown>;
		getAbstractFileByPath(path: string): unknown;
	};
	metadataCache: {
		getFileCache(file: unknown): { tags?: unknown[]; frontmatter?: { tags?: string[] } } | null;
	};
	workspace: { getLeavesOfType(type: string): Array<{ detach(): void }> };
}

declare global {
	var app: ObsidianE2EApp;
}

const fixtures = [
	{ name: "12 Branch A", tags: ["project", "a"] },
	{ name: "11 Branch A then B", tags: ["project", "a", "b"] },
	{ name: "10 Branch B", tags: ["project", "b"], frontmatter: true },
	{ name: "09 Branch B then A", tags: ["project", "b", "a"] },
	{ name: "08 Branch B then C", tags: ["project", "b", "c"] },
	{ name: "07 Branch B then C then A", tags: ["project", "b", "c", "a"] },
	{ name: "06 Task 2", tags: ["project", "task2"] },
	{ name: "05 Task 10", tags: ["project", "task10"] },
	{ name: "04 One", tags: ["project", "一"] },
	{ name: "03 One then Eight", tags: ["project", "一", "八"] },
	{ name: "02 Eight", tags: ["project", "八"] },
	{ name: "01 Eight then One", tags: ["project", "八", "一"] },
].map((fixture) => ({ ...fixture, path: `Order/${fixture.name}.md` }));

// Explicit orders detect both a sorted tag suffix and the wrong application locale.
const ascendingIndexes: Record<AppLanguage, number[]> = {
	ja: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
	zh: [10, 11, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7],
	"zh-TW": [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7],
};

const artifactDirectory = resolve(
	process.env.E2E_OBSIDIAN_LOCALE_ORDER_ARTIFACT_DIR ?? "_testdata/e2e-obsidian/locale-tag-order",
);
const listSelector = '.workspace-leaf-content[data-type="tagfolder-view-list"]';
const rowSelector = `${listSelector} .nav-file-title[data-path]`;
const treeSelector = '.workspace-split.mod-left-split .workspace-leaf-content:has(.tagfolder-buttons-container):not([data-type="tagfolder-view-list"])';
const treeRowSelector = `${treeSelector} .nav-folder:not(.mod-root):not(.is-collapsed) > .tree-item-children > .nav-file .nav-file-title[data-path]`;

async function openSettings(page: Page, id = TAGFOLDER_PLUGIN_ID): Promise<void> {
	await page.evaluate((tabId) => {
		globalThis.app.setting.open();
		if (!globalThis.app.setting.openTabById(tabId)) throw new Error(`Settings tab is unavailable: ${tabId}`);
	}, id);
}

async function closeSettings(page: Page): Promise<void> {
	await page.evaluate(() => globalThis.app.setting.close());
}

async function reloadObsidian(page: Page): Promise<void> {
	await page.reload();
	await waitForTagFolder(page);
}

async function waitForTagFolder(page: Page): Promise<void> {
	await page.waitForFunction((id) => globalThis.app?.plugins?.plugins?.[id] != null,
		TAGFOLDER_PLUGIN_ID, { timeout: 20_000 });
	await waitForObsidianPageUiIdle(page);
	await page.evaluate(async (id) => {
		await globalThis.app.plugins.plugins[id].loadFileInfoAsync();
	}, TAGFOLDER_PLUGIN_ID);
}

async function selectAppLanguage(page: Page, language: AppLanguage): Promise<void> {
	await openSettings(page, "about");
	const row = page.locator('.vertical-tab-content .setting-item').filter({
		has: page.locator('select option[value="zh-TW"]'),
	});
	const select = row.locator("select");
	await select.selectOption(language);
	assert.equal(await select.inputValue(), language);
	await Promise.all([
		page.waitForEvent("domcontentloaded"),
		row.getByRole("button").click(),
	]);
	await waitForTagFolder(page);
	assert.equal(await page.evaluate(() => localStorage.getItem("language")), language);
}

function languageSelect(page: Page): Locator {
	return page.locator('.vertical-tab-content select').filter({
		has: page.locator('option[value="auto"]'),
	});
}

async function selectInterfaceLanguage(page: Page, preference: LanguagePreference): Promise<void> {
	await openSettings(page);
	await languageSelect(page).selectOption(preference);
	await page.waitForFunction(({ id, preference }) => (
		globalThis.app.plugins.plugins[id].settings.uiLanguage === preference
	), { id: TAGFOLDER_PLUGIN_ID, preference });
	await languageSelect(page).waitFor({ state: "visible" });
}

async function assertInterfaceLanguage(page: Page, chinese: boolean): Promise<void> {
	await page.locator('.vertical-tab-content .setting-item-name')
		.filter({ hasText: chinese ? /^行为$/ : /^Behavior$/ }).waitFor({ state: "visible" });
	assert.equal(await languageSelect(page).count(), 1);
}

async function selectGroupingInSettings(page: Page): Promise<void> {
	const row = page.locator('.vertical-tab-content .setting-item').filter({
		has: page.locator('select option[value="TAGGROUP"]'),
	});
	await row.locator("select").first().selectOption("TAGGROUP");
	await row.locator("select").nth(1).selectOption("ASC");
}

async function openProjectList(page: Page): Promise<void> {
	await page.evaluate(async (id) => {
		await globalThis.app.plugins.plugins[id].activateView();
		await globalThis.app.plugins.plugins[id].openListView(["project"]);
	}, TAGFOLDER_PLUGIN_ID);
	await page.locator(listSelector).waitFor({ state: "visible" });
}

async function assertOrder(page: Page, language: AppLanguage, descending = false, selector = rowSelector): Promise<string[]> {
	const expected = ascendingIndexes[language].map((index) => fixtures[index].path);
	if (descending) expected.reverse();
	try {
		await page.waitForFunction(({ selector, expected }) => {
			const actual = Array.from(document.querySelectorAll<HTMLElement>(selector), (row) => row.dataset.path);
			return JSON.stringify(actual) === JSON.stringify(expected);
		}, { selector, expected }, { timeout: 10_000 });
	} catch {
		const actual = await page.locator(selector).evaluateAll((rows) => rows.map((row) => row.getAttribute("data-path")));
		assert.deepEqual(actual, expected, `Visible ${language} ${descending ? "descending" : "ascending"} order`);
	}
	await page.locator(`${selector} .nav-file-title-content`).filter({ hasText: "12 Branch A" }).waitFor();
	return expected;
}

async function selectGroupingInMenu(page: Page, descending: boolean, chinese: boolean, scope = listSelector): Promise<void> {
	await page.locator(scope).getByLabel(chinese ? "更改排序方式" : "Change sort order", { exact: true }).click();
	if (scope === treeSelector) {
		await page.locator(".menu-item").filter({ hasText: /^Items$/ }).click();
	}
	const direction = chinese ? (descending ? "降序" : "升序") : (descending ? "Descending" : "Ascending");
	await page.locator(".menu-item").filter({ hasText: new RegExp(`^Tag grouping ${direction}$`) }).click();
}

function projectTag(page: Page): Locator {
	return page.locator(`${treeSelector} .tagfolder-titletagname`).filter({ hasText: /^project$/ });
}

async function prepareLeftPane(page: Page): Promise<void> {
	await selectAppLanguage(page, "ja");
	await selectInterfaceLanguage(page, "auto");
	await assertInterfaceLanguage(page, false);
	await page.locator('.vertical-tab-content select').filter({
		has: page.locator('option[value="CURRENT_PANE"]'),
	}).selectOption("");
	await closeSettings(page);
	await page.evaluate(async (id) => {
		const app = globalThis.app;
		for (const leaf of app.workspace.getLeavesOfType("tagfolder-view-list")) leaf.detach();
		await app.plugins.plugins[id].activateView();
	}, TAGFOLDER_PLUGIN_ID);
	await page.locator(treeSelector).getByLabel("Collapse all", { exact: true }).click();
	await projectTag(page).scrollIntoViewIfNeeded();
	await projectTag(page).click();
}

async function openDefaultSidebarList(page: Page): Promise<void> {
	await openSettings(page);
	const setting = page.locator('.vertical-tab-content .setting-item').filter({
		has: page.locator('.setting-item-name').filter({ hasText: /^List files in a separated pane$/ }),
	});
	await setting.locator(".checkbox-container").click();
	await page.waitForFunction((id) => globalThis.app.plugins.plugins[id].settings.useMultiPaneList,
		TAGFOLDER_PLUGIN_ID);
	await closeSettings(page);
	await projectTag(page).click();
	await page.locator(listSelector).waitFor({ state: "visible" });
	assert.equal(await page.locator(listSelector).evaluate((element) => (
		element.closest(".workspace-split.mod-left-split") != null
	)), true, "The default separated list belongs to the left sidebar");
}

async function seedNotes(page: Page): Promise<void> {
	await page.evaluate(async ({ id, fixtures }) => {
		const { vault } = globalThis.app;
		await vault.createFolder("Order");
		for (const fixture of fixtures) {
			const content = fixture.frontmatter
				? `---\ntags:\n${fixture.tags.map((tag) => `  - ${tag}`).join("\n")}\n---\n`
				: fixture.tags.map((tag) => `#${tag}`).join(" ");
			await vault.create(fixture.path, content);
		}
		const plugin = globalThis.app.plugins.plugins[id];
		Object.assign(plugin.settings, {
			targetFolders: "Order/", sortExactFirst: false, useVirtualTag: true,
			displayFolderAsTag: true, showListIn: "CURRENT_PANE",
		});
		await plugin.saveSettings();
	}, { id: TAGFOLDER_PLUGIN_ID, fixtures });
	await page.waitForFunction((fixtures) => fixtures.every((fixture) => {
		const file = globalThis.app.vault.getAbstractFileByPath(fixture.path);
		const cache = file ? globalThis.app.metadataCache.getFileCache(file) : null;
		return fixture.frontmatter
			? cache?.frontmatter?.tags?.length === fixture.tags.length
			: cache?.tags?.length === fixture.tags.length;
	}), fixtures, { timeout: 10_000 });
	await page.evaluate(async (id) => globalThis.app.plugins.plugins[id].loadFileInfoAsync(), TAGFOLDER_PLUGIN_ID);
	const actual = await page.evaluate((id) => globalThis.app.plugins.plugins[id].allViewItems, TAGFOLDER_PLUGIN_ID);
	for (const fixture of fixtures) {
		const item = actual.find((item) => item.path === fixture.path);
		assert.ok(item, `View item for ${fixture.path}`);
		assert.deepEqual(item.tags.filter((tag) => !tag.startsWith("_")), fixture.tags, `Written tags for ${fixture.path}`);
		assert.ok(item.tags.some((tag) => tag.startsWith("_VIRTUAL_TAG_")), "Virtual tags participate in the fixture");
	}
}

async function main(): Promise<void> {
	await mkdir(artifactDirectory, { recursive: true });
	const screenshots: string[] = [];
	const checks: Array<{ stage: string; paths: string[] }> = [];
	const pageErrors: string[] = [];
	let stage = "start";
	let testSession: TagFolderTestSession | undefined;
	const run = async (
		action: (
			page: Page,
			capture: (name: string) => Promise<void>,
			check: (name: string, language: AppLanguage, descending?: boolean, selector?: string) => Promise<void>,
		) => Promise<void>,
	): Promise<void> => {
		assert.ok(testSession);
		await withObsidianPage(testSession.session.remoteDebuggingPort, async (page) => {
			page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));
			await page.setViewportSize({ width: 1280, height: 960 });
			const capture = async (name: string): Promise<void> => {
				const path = join(artifactDirectory, `${name}.png`);
				await page.screenshot({ path });
				screenshots.push(path);
			};
			const check = async (name: string, language: AppLanguage, descending = false, selector = rowSelector): Promise<void> => {
				stage = name;
				checks.push({ stage, paths: await assertOrder(page, language, descending, selector) });
			};
			try {
				await action(page, capture, check);
			} catch (error) {
				await capture("failure").catch(() => undefined);
				throw error;
			}
		});
	};
	try {
		testSession = await startTagFolderTestSession();
		await run(async (page) => {
			stage = "seed-notes";
			await seedNotes(page);
			stage = "select Japanese application language";
			await selectAppLanguage(page, "ja");
		});
		await run(async (page, capture, check) => {
			await selectInterfaceLanguage(page, "auto");
			await assertInterfaceLanguage(page, false);
			await capture("01-japanese-auto-settings");
			await selectGroupingInSettings(page);
			await closeSettings(page);
			await openProjectList(page);
			await check("Japanese auto ascending", "ja");
			await capture("02-japanese-auto-ascending");

			await selectInterfaceLanguage(page, "zh-CN");
			await assertInterfaceLanguage(page, true);
			await capture("03-japanese-chinese-settings");
			await closeSettings(page);
			await check("Chinese interface retains Japanese order", "ja");
			await selectGroupingInMenu(page, true, true);
			await check("Japanese descending through Chinese menu", "ja", true);
			await capture("04-japanese-chinese-descending");

			await selectInterfaceLanguage(page, "en");
			await assertInterfaceLanguage(page, false);
			await closeSettings(page);
			await check("English interface retains Japanese descending order", "ja", true);
			assert.ok(testSession);
			const saved = JSON.parse(await readFile(join(testSession.vault.path, ".obsidian/plugins", TAGFOLDER_PLUGIN_ID, "data.json"), "utf8")) as TagFolderE2EPlugin["settings"];
			assert.equal(saved.uiLanguage, "en");
			assert.equal(saved.sortType, "TAGGROUP_DESC");
			await reloadObsidian(page);
			await openProjectList(page);
			await check("Saved descending order after reload", "ja", true);
			await openSettings(page);
			await assertInterfaceLanguage(page, false);
			assert.equal(await languageSelect(page).inputValue(), "en");
			await closeSettings(page);
			await capture("05-japanese-english-after-reload");

			await selectAppLanguage(page, "zh");
		});
		await run(async (page, capture, check) => {
			await selectInterfaceLanguage(page, "auto");
			await assertInterfaceLanguage(page, true);
			await capture("06-simplified-chinese-auto-settings");
			await closeSettings(page);
			await openProjectList(page);
			await selectGroupingInMenu(page, false, true);
			await check("Simplified Chinese auto ascending", "zh");
			await capture("07-simplified-chinese-auto-ascending");
			await selectInterfaceLanguage(page, "en");
			await assertInterfaceLanguage(page, false);
			await closeSettings(page);
			await check("English interface retains Chinese order", "zh");

			await selectAppLanguage(page, "zh-TW");
		});
		await run(async (page, capture, check) => {
			await selectInterfaceLanguage(page, "auto");
			await assertInterfaceLanguage(page, false);
			await capture("08-traditional-chinese-auto-settings");
			await closeSettings(page);
			await openProjectList(page);
			await check("Traditional Chinese auto ascending", "zh-TW");
			await capture("09-traditional-chinese-auto-ascending");

			await prepareLeftPane(page);
			await selectGroupingInMenu(page, false, false, treeSelector);
			await check("Japanese ascending inside the left tag tree", "ja", false, treeRowSelector);
			await capture("10-left-tag-tree-ascending");
			await selectGroupingInMenu(page, true, false, treeSelector);
			await check("Japanese descending inside the left tag tree", "ja", true, treeRowSelector);
			await capture("11-left-tag-tree-descending");
			await openDefaultSidebarList(page);
			await check("Japanese descending in the default separated sidebar list", "ja", true);
			await capture("12-default-left-sidebar-list");
		});
		assert.deepEqual(pageErrors, [], "Uncaught errors in the Obsidian renderer");
		await writeFile(join(artifactDirectory, "report.json"), JSON.stringify({ status: "passed", fixtures, checks, screenshots, pageErrors }, null, 2));
		console.log(`TagFolder application locales, written tag order, and saved settings passed in real Obsidian. Artefacts: ${artifactDirectory}`);
	} catch (error) {
		await writeFile(join(artifactDirectory, "report.json"), JSON.stringify({
			status: "failed", stage, fixtures, checks, screenshots, pageErrors,
			error: error instanceof Error ? error.stack : String(error),
		}, null, 2));
		throw error;
	} finally {
		if (testSession) await stopTagFolderTestSession(testSession);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.stack : error);
	process.exitCode = 1;
});
