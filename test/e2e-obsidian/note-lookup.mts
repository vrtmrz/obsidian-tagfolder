import { withObsidianPage } from "@vrtmrz/obsidian-test-session";
import type { Page } from "playwright";
import {
	TAGFOLDER_PLUGIN_ID,
	startTagFolderTestSession,
	stopTagFolderTestSession,
	type TagFolderTestSession,
} from "./harness.mts";

const OPEN_BY_TAGS_COMMAND = `${TAGFOLDER_PLUGIN_ID}:tagfolder-open-note-by-tags`;
const OPEN_SIMILAR_COMMAND = `${TAGFOLDER_PLUGIN_ID}:tagfolder-open-note-with-similar-tags`;

async function seedLookupNotes(testSession: TagFolderTestSession): Promise<void> {
	await withObsidianPage(testSession.session.remoteDebuggingPort, async (page) => {
		await page.evaluate(async () => {
			const obsidianApp = (
				globalThis as typeof globalThis & {
					app?: {
						vault?: {
							create(path: string, content: string): Promise<unknown>;
						};
					};
			}
		).app;
			const vault = obsidianApp?.vault;
			if (!vault) throw new Error("Obsidian Vault is unavailable");
			await vault.create("Alpha.md", "#foo #bar");
			await vault.create("Beta.md", "#foo");
			await vault.create("Archived.md", "#bar #archive");
			await vault.create("This is an extremely long note filename for a narrow mobile screen.md", "#foo #bar");
		});

		await page.waitForFunction(() => {
			const obsidianApp = (
				globalThis as typeof globalThis & {
					app?: {
						metadataCache?: { getFileCache(file: unknown): { tags?: unknown[] } | null };
						vault?: { getAbstractFileByPath(path: string): unknown };
					};
			}
		).app;
			const file = obsidianApp?.vault?.getAbstractFileByPath("Alpha.md");
			return file != null && (obsidianApp?.metadataCache?.getFileCache(file)?.tags?.length ?? 0) >= 2;
		}, undefined, { timeout: 10_000 });
	});
}

async function executeCommand(page: Page, commandId: string) {
	const executed = await page.evaluate((id) => {
		const obsidianApp = (
			globalThis as typeof globalThis & {
				app?: { commands?: { executeCommandById(commandId: string): boolean } };
			}
		).app;
		return obsidianApp?.commands?.executeCommandById(id) ?? false;
	}, commandId);
	if (!executed) throw new Error(`Command was unavailable: ${commandId}`);
}

async function verifyLookupWorkflow(testSession: TagFolderTestSession): Promise<void> {
	await withObsidianPage(testSession.session.remoteDebuggingPort, async (page) => {
		await executeCommand(page, OPEN_BY_TAGS_COMMAND);

		const modal = page.locator(".tagfolder-note-lookup-modal");
		await modal.waitFor({ state: "visible", timeout: 10_000 });
		const tagInput = modal.locator("#tagfolder-note-lookup-tag-input");
		const noteInput = modal.locator("#tagfolder-note-lookup-note-input");
		const completions = modal.locator(".completions");

		await tagInput.fill("fo");
		await completions.waitFor({ state: "visible" });
		await completions.locator(".completion.suggestion-item.is-selected").waitFor();
		await tagInput.press("Tab");
		await completions.waitFor({ state: "hidden" });
		await noteInput.press("Shift+Tab");
		await completions.waitFor({ state: "visible" });
		await tagInput.fill("");

		await tagInput.fill("foo");
		await tagInput.press("Enter");
		const fooChip = modal.locator(".tag-chip.multi-select-pill").filter({ hasText: "#foo" });
		await fooChip.waitFor();
		await fooChip.locator(".multi-select-pill-content").waitFor();
		await fooChip.locator(".multi-select-pill-remove-button").waitFor();

		await tagInput.fill("bar");
		await tagInput.press("Enter");
		const barChip = modal.locator(".tag-chip").filter({ hasText: "#bar" });
		await barChip.waitFor();
		await tagInput.press("ArrowLeft");
		await tagInput.press("Delete");
		await barChip.waitFor({ state: "detached" });
		await tagInput.fill("bar");
		await tagInput.press("Enter");
		await barChip.waitFor();

		await tagInput.fill("-archive");
		await tagInput.press("Enter");
		await modal.locator(".tag-chip.excluded").filter({ hasText: "#archive" }).waitFor();

		await modal.locator(".note-result").filter({ hasText: "Alpha" }).filter({ hasText: "2/2" }).waitFor();
		if (await modal.locator(".note-result").filter({ hasText: "Archived" }).count() != 0) {
			throw new Error("The excluded archive tag remained in the results");
		}
		const selectionColours = await modal.locator(".notes").evaluate((list) => {
			const active = list.querySelector<HTMLElement>(".note-result.is-selected");
			const inactive = list.querySelector<HTMLElement>(".note-result:not(.is-selected)");
			if (!active || !inactive) throw new Error("Active and inactive result rows were unavailable");
			return {
				active: getComputedStyle(active).backgroundColor,
				inactive: getComputedStyle(inactive).backgroundColor,
			};
		});
		if (selectionColours.active == selectionColours.inactive) {
			throw new Error(`The active note row was not highlighted: ${JSON.stringify(selectionColours)}`);
		}

		await tagInput.press("Tab");
		if (!await noteInput.evaluate((element) => element === element.ownerDocument.activeElement)) {
			throw new Error("Tab did not move focus to the note input");
		}
		await page.setViewportSize({ width: 390, height: 430 });
		await noteInput.fill("extremely");
		const longNameResult = modal.locator(".note-result").filter({ hasText: "extremely long" });
		await longNameResult.waitFor();
		const longNameLayout = await longNameResult.evaluate((row) => {
			const fileName = row.querySelector<HTMLElement>(".note-file-name");
			const matchCount = row.querySelector<HTMLElement>(".match-count");
			if (!fileName || !matchCount) throw new Error("Long-name result structure was unavailable");
			const fileRect = fileName.getBoundingClientRect();
			const countRect = matchCount.getBoundingClientRect();
			const rowRect = row.getBoundingClientRect();
			const rowCentre = (rowRect.top + rowRect.bottom) / 2;
			return {
				usesEllipsis: getComputedStyle(fileName).textOverflow == "ellipsis",
				isTruncated: fileName.scrollWidth > fileName.clientWidth,
				doesNotOverlapCount: fileRect.right <= countRect.left,
				doesNotOverflowRow: row.scrollWidth <= row.clientWidth,
				fileNameIsVerticallyCentred: Math.abs((fileRect.top + fileRect.bottom) / 2 - rowCentre) <= 1,
				matchCountIsVerticallyCentred: Math.abs((countRect.top + countRect.bottom) / 2 - rowCentre) <= 1,
			};
		});
		if (!Object.values(longNameLayout).every(Boolean)) {
			throw new Error(`Long note name was not safely truncated: ${JSON.stringify(longNameLayout)}`);
		}
		await page.setViewportSize({ width: 1280, height: 960 });
		await noteInput.fill("alpha");
		await noteInput.press("Enter");

		await page.waitForFunction(() => {
			const obsidianApp = (
				globalThis as typeof globalThis & {
					app?: { workspace?: { getActiveFile(): { path: string } | null } };
			}
		).app;
			return obsidianApp?.workspace?.getActiveFile()?.path == "Alpha.md";
		}, undefined, { timeout: 10_000 });

		await executeCommand(page, OPEN_SIMILAR_COMMAND);
		await modal.waitFor({ state: "visible", timeout: 10_000 });
		await modal.locator(".tag-chip").filter({ hasText: "#foo" }).waitFor();
		await modal.locator(".tag-chip").filter({ hasText: "#bar" }).waitFor();
		if (await modal.locator(".note-result").filter({ hasText: "Alpha" }).count() != 0) {
			throw new Error("The source note remained in similar-note results");
		}
		await modal.locator("#tagfolder-note-lookup-tag-input").press("Escape");
	});
}

async function main(): Promise<void> {
	let testSession: TagFolderTestSession | undefined;
	try {
		testSession = await startTagFolderTestSession();
		await seedLookupNotes(testSession);
		await verifyLookupWorkflow(testSession);
		console.log("TagFolder note lookup passed in real Obsidian");
	} finally {
		if (testSession) await stopTagFolderTestSession(testSession);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.stack : error);
	process.exit(1);
});
