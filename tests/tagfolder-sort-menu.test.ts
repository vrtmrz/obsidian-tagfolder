import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceLeaf } from "obsidian";
import { TagFolderViewBase } from "../TagFolderViewBase";
import {
	DEFAULT_SETTINGS,
	VIEW_TYPE_TAGFOLDER,
	VIEW_TYPE_TAGFOLDER_LINK,
	VIEW_TYPE_TAGFOLDER_LIST,
	type TagFolderSettings,
} from "../types";

const { FakeMenu, menuInstances } = vi.hoisted(() => {
	class FakeMenuItem {
		title = "";
		icon: string | undefined;
		private clickHandler: ((event: MouseEvent) => unknown) | undefined;

		setTitle(title: string) {
			this.title = title;
			return this;
		}

		setIcon(icon: string) {
			this.icon = icon;
			return this;
		}

		onClick(callback: (event: MouseEvent) => unknown) {
			this.clickHandler = callback;
			return this;
		}

		click(event = new MouseEvent("click")) {
			return this.clickHandler?.(event);
		}
	}

	class FakeMenu {
		items: FakeMenuItem[] = [];
		mouseEvent: MouseEvent | undefined;
		position: { x: number; y: number } | undefined;

		constructor() {
			menuInstances.push(this);
		}

		addItem(callback: (item: FakeMenuItem) => unknown) {
			const item = new FakeMenuItem();
			callback(item);
			this.items.push(item);
			return this;
		}

		showAtMouseEvent(event: MouseEvent) {
			this.mouseEvent = event;
		}

		showAtPosition(position: { x: number; y: number }) {
			this.position = position;
		}
	}

	const menuInstances: FakeMenu[] = [];
	return { FakeMenu, menuInstances };
});

vi.mock("obsidian", async (importOriginal) => {
	const actual = await importOriginal<typeof import("obsidian")>();
	return { ...actual, Menu: FakeMenu };
});

vi.mock("dialog", () => ({ askString: vi.fn() }));
vi.mock("../main", () => ({ default: class {} }));

const itemSortOptions: Array<{
	title: string;
	value: TagFolderSettings["sortType"];
}> = [
	{ title: "Displaying name Ascending", value: "DISPNAME_ASC" },
	{ title: "Displaying name Descending", value: "DISPNAME_DESC" },
	{ title: "File name Ascending", value: "NAME_ASC" },
	{ title: "File name Descending", value: "NAME_DESC" },
	{ title: "Modified time Ascending", value: "MTIME_ASC" },
	{ title: "Modified time Descending", value: "MTIME_DESC" },
	{ title: "Created time Ascending", value: "CTIME_ASC" },
	{ title: "Created time Descending", value: "CTIME_DESC" },
	{ title: "Fullpath of the file Ascending", value: "FULLPATH_ASC" },
	{ title: "Fullpath of the file Descending", value: "FULLPATH_DESC" },
];

const tagSortOptions: Array<{
	title: string;
	value: TagFolderSettings["sortTypeTag"];
}> = [
	{ title: "Tag name Ascending", value: "NAME_ASC" },
	{ title: "Tag name Descending", value: "NAME_DESC" },
	{ title: "Count of items Ascending", value: "ITEMS_ASC" },
	{ title: "Count of items Descending", value: "ITEMS_DESC" },
];

function createPlugin(
	sortType: TagFolderSettings["sortType"] = DEFAULT_SETTINGS.sortType,
	sortTypeTag: TagFolderSettings["sortTypeTag"] = DEFAULT_SETTINGS.sortTypeTag,
) {
	return {
		settings: { ...DEFAULT_SETTINGS, sortType, sortTypeTag },
		saveSettings: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
	};
}

type TestPlugin = ReturnType<typeof createPlugin>;

class TestView extends TagFolderViewBase {
	private readonly viewType: string;

	constructor(viewType: string, plugin: TestPlugin) {
		super({} as WorkspaceLeaf);
		this.viewType = viewType;
		this.plugin = plugin as unknown as TagFolderViewBase["plugin"];
	}

	getViewType() {
		return this.viewType;
	}

	getDisplayText() {
		return this.viewType;
	}
}

describe("TagFolderViewBase.showOrder", () => {
	beforeEach(() => {
		menuInstances.length = 0;
	});

	it("shows every item sort option directly for list views and saves each selection", async () => {
		const plugin = createPlugin("MTIME_DESC");
		const view = new TestView(VIEW_TYPE_TAGFOLDER_LIST, plugin);
		const event = new MouseEvent("contextmenu");

		view.showOrder(event);

		expect(menuInstances).toHaveLength(1);
		const menu = menuInstances[0];
		expect(menu.mouseEvent).toBe(event);
		expect(menu.items.map((item) => item.title)).toEqual(
			itemSortOptions.map((option) => option.title),
		);
		expect(menu.items.some((item) => item.title == "Tags")).toBe(false);
		expect(menu.items.some((item) => item.title == "Items")).toBe(false);
		expect(menu.items.filter((item) => item.icon == "checkmark").map((item) => item.title)).toEqual([
			"Modified time Descending",
		]);

		for (const [index, option] of itemSortOptions.entries()) {
			await menu.items[index].click();
			expect(plugin.settings.sortType).toBe(option.value);
			expect(plugin.settings.sortTypeTag).toBe(DEFAULT_SETTINGS.sortTypeTag);
			expect(plugin.saveSettings).toHaveBeenCalledTimes(index + 1);
			view.showOrder(event);
			const reopenedMenu = menuInstances[menuInstances.length - 1];
			expect(reopenedMenu.items.filter((item) => item.icon == "checkmark").map((item) => item.title)).toEqual([
				option.title,
			]);
		}
	});

	for (const viewType of [VIEW_TYPE_TAGFOLDER, VIEW_TYPE_TAGFOLDER_LINK]) {
		it(`keeps Tags and Items submenus for ${viewType}`, async () => {
			const plugin = createPlugin("FULLPATH_ASC", "ITEMS_DESC");
			const view = new TestView(viewType, plugin);
			const event = new MouseEvent("contextmenu");

			view.showOrder(event);

			expect(menuInstances).toHaveLength(1);
			const menu = menuInstances[0];
			expect(menu.items.map((item) => item.title)).toEqual(["Tags", "Items"]);

			await menu.items[0].click(event);
			expect(menuInstances).toHaveLength(2);
			const tagMenu = menuInstances[1];
			expect(tagMenu.position).toEqual({ x: event.x, y: event.y });
			expect(tagMenu.items.map((item) => item.title)).toEqual(
				tagSortOptions.map((option) => option.title),
			);
			expect(tagMenu.items.filter((item) => item.icon == "checkmark").map((item) => item.title)).toEqual([
				"Count of items Descending",
			]);

			await tagMenu.items[0].click(event);
			expect(plugin.settings.sortTypeTag).toBe("NAME_ASC");
			expect(plugin.saveSettings).toHaveBeenCalledTimes(1);

			await menu.items[1].click(event);
			expect(menuInstances).toHaveLength(3);
			const itemMenu = menuInstances[2];
			expect(itemMenu.position).toEqual({ x: event.x, y: event.y });
			expect(itemMenu.items.map((item) => item.title)).toEqual(
				itemSortOptions.map((option) => option.title),
			);
			expect(itemMenu.items.filter((item) => item.icon == "checkmark").map((item) => item.title)).toEqual([
				"Fullpath of the file Ascending",
			]);

			await itemMenu.items[9].click(event);
			expect(plugin.settings.sortType).toBe("FULLPATH_DESC");
			expect(plugin.settings.sortTypeTag).toBe("NAME_ASC");
			expect(plugin.saveSettings).toHaveBeenCalledTimes(2);
		});
	}
});
