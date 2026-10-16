import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import TagFolderViewComponent from "../TagFolderViewComponent.svelte";
import { allViewItems, searchString, tagFolderSetting } from "../store";
import { DEFAULT_SETTINGS, type ViewItem } from "../types";
import { viewItem } from "./test-utils";

const child = vi.hoisted(() => ({
	props: undefined as { items: ViewItem[] } | undefined,
}));

vi.mock("../V2TreeFolderComponent.svelte", () => ({
	default: (_anchor: unknown, props: { items: ViewItem[] }) => {
		child.props = props;
		return {};
	},
}));

vi.mock("obsidian", async (importOriginal) => ({
	...await importOriginal<typeof import("obsidian")>(),
	setIcon: vi.fn(),
}));

let target: HTMLDivElement;
let component: ReturnType<typeof mount> | undefined;

beforeEach(() => {
	target = window.document.createElement("div");
	window.document.body.append(target);
	child.props = undefined;
	searchString.set("");
	vi.stubGlobal("IntersectionObserver", class {
		observe() {}
		unobserve() {}
		disconnect() {}
	});
});

afterEach(async () => {
	if (component) await unmount(component);
	component = undefined;
	target.remove();
	allViewItems.set([]);
	tagFolderSetting.set(structuredClone(DEFAULT_SETTINGS));
	vi.unstubAllGlobals();
});

describe("archive filtering in file lists", () => {
	it.each([
		["*/done", "project", "project", ["active.md"]],
		["arch*/done", "archaeology", "archaeology", ["active.md"]],
		["archive/*", "archive/", "project", ["archived.md"]],
		["archive/*", "project", "project", ["active.md"]],
	] as const)("routes %s to the matching archive branch when listing %s", async (pattern, branch, otherTag, expected) => {
		allViewItems.set([
			viewItem("active.md", [otherTag]),
			viewItem("archived.md", ["archive/done", otherTag]),
		]);
		tagFolderSetting.set({ ...structuredClone(DEFAULT_SETTINGS), archiveTags: pattern });
		component = mount(TagFolderViewComponent, {
			target,
			props: {
				tags: [branch],
				hoverPreview: vi.fn(),
				openFile: vi.fn(),
				saveSettings: vi.fn().mockResolvedValue(undefined),
				showMenu: vi.fn(),
				showLevelSelect: vi.fn(),
				showOrder: vi.fn(),
				newNote: vi.fn(),
				openScrollView: vi.fn().mockResolvedValue(undefined),
				isViewSwitchable: false,
				switchView: vi.fn(),
			},
		});
		await tick();

		expect(child.props).toBeDefined();
		expect(child.props!.items.map((item) => item.path)).toEqual(expected);
	});
});
