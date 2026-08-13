import { withObsidianPage } from "@vrtmrz/obsidian-test-session";
import type { Page } from "playwright";
import {
	TAGFOLDER_PLUGIN_ID,
	startTagFolderTestSession,
	stopTagFolderTestSession,
	type TagFolderTestSession,
} from "./harness.mts";

interface TagFolderE2EPlugin {
	settings: {
		disableNarrowingDown: boolean;
		disableNestedTags: boolean;
		hideItems: string;
		reduceNestedParent: boolean;
		mergeRedundantCombination: boolean;
		doNotSimplifyTags: boolean;
	};
	allViewItems: Array<{
		path: string;
		tags: string[];
		extraTags: string[];
	}>;
	loadFileInfoAsync(): Promise<void>;
}

interface ObsidianE2EApp {
	metadataCache?: { getFileCache(file: unknown): { tags?: unknown[] } | null };
	plugins?: { plugins?: Record<string, TagFolderE2EPlugin> };
	setting?: {
		open(): void;
		openTabById(id: string): void;
	};
	vault?: {
		create(path: string, content: string): Promise<unknown>;
		getAbstractFileByPath(path: string): unknown;
	};
}

async function seedPreviewNotes(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const obsidianApp = (
			globalThis as typeof globalThis & { app?: ObsidianE2EApp }
		).app;
		const vault = obsidianApp?.vault;
		if (!vault) throw new Error("Obsidian Vault is unavailable");
		await vault.create("Roadmap.md", "#project/atlas #status/active");
		await vault.create("Release note.md", "#project/atlas #status/done");
	});

	await page.waitForFunction(() => {
		const obsidianApp = (
			globalThis as typeof globalThis & { app?: ObsidianE2EApp }
		).app;
		const roadmap = obsidianApp?.vault?.getAbstractFileByPath("Roadmap.md");
		const release = obsidianApp?.vault?.getAbstractFileByPath("Release note.md");
		return roadmap != null
			&& release != null
			&& (obsidianApp?.metadataCache?.getFileCache(roadmap)?.tags?.length ?? 0) === 2
			&& (obsidianApp?.metadataCache?.getFileCache(release)?.tags?.length ?? 0) === 2;
	}, undefined, { timeout: 10_000 });

	await page.evaluate(async (pluginId) => {
		const obsidianApp = (
			globalThis as typeof globalThis & { app?: ObsidianE2EApp }
		).app;
		const plugin = obsidianApp?.plugins?.plugins?.[pluginId];
		if (!plugin) throw new Error(`TagFolder is not loaded: ${pluginId}`);
		await plugin.loadFileInfoAsync();
	}, TAGFOLDER_PLUGIN_ID);
}

async function openTagFolderSettings(page: Page): Promise<void> {
	await page.evaluate((pluginId) => {
		const obsidianApp = (
			globalThis as typeof globalThis & { app?: ObsidianE2EApp }
		).app;
		const setting = obsidianApp?.setting;
		if (!setting) throw new Error("Obsidian settings are unavailable");
		setting.open();
		setting.openTabById(pluginId);
	}, TAGFOLDER_PLUGIN_ID);
}

async function verifyTagTreeStyleSuggestion(testSession: TagFolderTestSession): Promise<void> {
	await withObsidianPage(testSession.session.remoteDebuggingPort, async (page) => {
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));
		await page.setViewportSize({ width: 1280, height: 960 });
		await seedPreviewNotes(page);
		await openTagFolderSettings(page);

		const suggestionGroup = page.locator(".tagfolder-style-suggestion");
		const setting = suggestionGroup.locator(".setting-item");
		await setting.waitFor({ state: "visible", timeout: 10_000 });
		const preview = suggestionGroup.locator(".tagfolder-style-preview");
		if (await preview.isVisible()) throw new Error("The style preview was visible before a style was selected");

		await setting.locator("select").selectOption("simple-list");
		await preview.waitFor({ state: "visible" });
		for (const expectedText of [
			"Show notes directly beneath each tag",
			"Roadmap",
			"#project/atlas#status/active",
			"Rendered project branch",
			"status/done",
		]) {
			if (!(await preview.textContent())?.includes(expectedText)) {
				throw new Error(`The style preview did not contain ${JSON.stringify(expectedText)}`);
			}
		}

		const previewScreenshot = process.env.E2E_OBSIDIAN_STYLE_PREVIEW_SCREENSHOT;
		if (previewScreenshot) {
			await suggestionGroup.scrollIntoViewIfNeeded();
			await suggestionGroup.screenshot({ path: previewScreenshot });
		}

		await page.setViewportSize({ width: 390, height: 844 });
		await page.evaluate(() => document.body.classList.add("is-mobile", "is-phone"));
		await suggestionGroup.evaluate((element) => element.scrollIntoView({ block: "center" }));
		const mobileLayout = await suggestionGroup.evaluate((element) => {
			const previewElement = element.querySelector<HTMLElement>(".tagfolder-style-preview");
			const sampleElement = element.querySelector<HTMLElement>(".tagfolder-style-preview-sample");
			const treeElement = element.querySelector<HTMLElement>(".tagfolder-style-preview-tree");
			if (!previewElement || !sampleElement || !treeElement) {
				throw new Error("The mobile style preview elements were unavailable");
			}
			return {
				groupFits: element.scrollWidth <= element.clientWidth,
				previewFits: previewElement.scrollWidth <= previewElement.clientWidth,
				sampleFits: sampleElement.scrollWidth <= sampleElement.clientWidth,
				treeFits: treeElement.scrollWidth <= treeElement.clientWidth,
			};
		});
		if (!Object.values(mobileLayout).every(Boolean)) {
			throw new Error(`The style suggestion overflowed at phone width: ${JSON.stringify(mobileLayout)}`);
		}
		const mobileScreenshot = process.env.E2E_OBSIDIAN_STYLE_MOBILE_SCREENSHOT;
		if (mobileScreenshot) await suggestionGroup.screenshot({ path: mobileScreenshot });
		await page.evaluate(() => document.body.classList.remove("is-mobile", "is-phone"));
		await page.setViewportSize({ width: 1280, height: 960 });

		const applyButton = setting.getByRole("button", { name: "Apply" });
		if (!await applyButton.isEnabled()) throw new Error("Apply was disabled after selecting a style");
		await applyButton.click();
		await page.waitForTimeout(500);
		const appliedImmediately = await page.evaluate((pluginId) => {
			const obsidianApp = (
				globalThis as typeof globalThis & { app?: ObsidianE2EApp }
			).app;
			const plugin = obsidianApp?.plugins?.plugins?.[pluginId];
			return plugin?.settings.disableNarrowingDown ?? false;
		}, TAGFOLDER_PLUGIN_ID);
		if (!appliedImmediately) {
			throw new Error(`Apply did not update TagFolder settings. Page errors: ${JSON.stringify(pageErrors)}`);
		}

		const rebuiltItems = await page.evaluate((pluginId) => {
			const obsidianApp = (
				globalThis as typeof globalThis & { app?: ObsidianE2EApp }
			).app;
			const plugin = obsidianApp?.plugins?.plugins?.[pluginId];
			if (!plugin) throw new Error(`TagFolder is not loaded: ${pluginId}`);
			return plugin.allViewItems.filter(
				(item) => item.path === "Roadmap.md" || item.path === "Release note.md",
			);
		}, TAGFOLDER_PLUGIN_ID);
		const roadmapItems = rebuiltItems.filter((item) => item.path === "Roadmap.md");
		const releaseItems = rebuiltItems.filter((item) => item.path === "Release note.md");
		if (
			roadmapItems.length !== 2
			|| releaseItems.length !== 2
			|| rebuiltItems.some((item) => item.tags.length !== 1 || item.extraTags.length !== 1)
		) {
			throw new Error(`The applied style did not rebuild the view items: ${JSON.stringify(rebuiltItems)}`);
		}

		const applied = await page.evaluate((pluginId) => {
			const obsidianApp = (
				globalThis as typeof globalThis & { app?: ObsidianE2EApp }
			).app;
			const plugin = obsidianApp?.plugins?.plugins?.[pluginId];
			if (!plugin) throw new Error(`TagFolder is not loaded: ${pluginId}`);
			return plugin.settings;
		}, TAGFOLDER_PLUGIN_ID);
		if (
			!applied.disableNarrowingDown
			|| applied.disableNestedTags
			|| applied.hideItems !== "DEDICATED_INTERMIDIATES"
			|| !applied.reduceNestedParent
			|| applied.mergeRedundantCombination
			|| applied.doNotSimplifyTags
		) {
			throw new Error(`Unexpected applied style settings: ${JSON.stringify(applied)}`);
		}
		const resetSelection = await page.locator(".tagfolder-style-suggestion select").inputValue();
		if (resetSelection !== "") throw new Error("The suggestion selection did not reset after Apply");
	});
}

async function main(): Promise<void> {
	let testSession: TagFolderTestSession | undefined;
	try {
		testSession = await startTagFolderTestSession();
		await verifyTagTreeStyleSuggestion(testSession);
		console.log("TagFolder style suggestion preview and application passed in real Obsidian");
	} finally {
		if (testSession) await stopTagFolderTestSession(testSession);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.stack : error);
	process.exit(1);
});
