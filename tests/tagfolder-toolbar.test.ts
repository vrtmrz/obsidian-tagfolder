import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount, type ComponentProps } from "svelte";
import { writable } from "svelte/store";
import TagFolderViewComponent from "../TagFolderViewComponent.svelte";
import { searchString, tagFolderSetting } from "../store";
import { DEFAULT_SETTINGS, type TagFolderListState } from "../types";

vi.mock("../V2TreeFolderComponent.svelte", () => ({ default: () => ({}) }));

vi.mock("obsidian", async (importOriginal) => ({
	...await importOriginal<typeof import("obsidian")>(),
	setIcon(element: HTMLElement, iconId: string) {
		const svg = element.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("data-icon", iconId);
		element.replaceChildren(svg);
	},
}));

type ViewProps = ComponentProps<typeof TagFolderViewComponent>;

let target: HTMLDivElement;
let component: ReturnType<typeof mount> | undefined;

beforeEach(() => {
	target = window.document.createElement("div");
	window.document.body.append(target);
	searchString.set("");
	tagFolderSetting.set(structuredClone(DEFAULT_SETTINGS));
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
	vi.unstubAllGlobals();
});

async function renderToolbar(overrides: Partial<ViewProps> = {}) {
	const showOrder = vi.fn();
	component = mount(TagFolderViewComponent, {
		target,
		props: {
			hoverPreview: vi.fn(),
			openFile: vi.fn(),
			saveSettings: vi.fn().mockResolvedValue(undefined),
			showMenu: vi.fn(),
			showLevelSelect: vi.fn(),
			showOrder,
			newNote: vi.fn(),
			openScrollView: vi.fn().mockResolvedValue(undefined),
			isViewSwitchable: false,
			switchView: vi.fn(),
			...overrides,
		},
	});
	await tick();
	return showOrder;
}

function sortButton() {
	const button = target.querySelector<HTMLElement>('[aria-label="Change sort order"]');
	expect(button).not.toBeNull();
	expect(button?.querySelector('svg[data-icon="lucide-sort-asc"]')).not.toBeNull();
	return button!;
}

describe("sort toolbar", () => {
	it.each([["project"], ["project/client"]])(
		"shows an initialised sort button on a list filtered by %s",
		async (tag) => {
			const showOrder = await renderToolbar({ tags: [tag] });
			const event = new MouseEvent("click", { bubbles: true, clientX: 20, clientY: 30 });
			sortButton().dispatchEvent(event);

			expect(showOrder).toHaveBeenCalledOnce();
			expect(showOrder.mock.calls[0][0]).toBe(event);
			expect(target.querySelector('[aria-label="Expand limit"]')).toBeNull();
			expect(target.querySelector('[aria-label="Search"]')).toBeNull();
		},
	);

	it("keeps the sort button available when list state supplies and changes its tags", async () => {
		const stateStore = writable<TagFolderListState>({ tags: ["project"], title: "project" });
		const showOrder = await renderToolbar({ stateStore });
		sortButton();
		expect(target.querySelector('[aria-label="Expand limit"]')).toBeNull();
		expect(target.querySelector('[aria-label="Search"]')).toBeNull();

		stateStore.set({ tags: ["area/home"], title: "area/home" });
		await tick();
		sortButton().click();
		expect(showOrder).toHaveBeenCalledOnce();
	});

	it.each(["tags", "links"] as const)("preserves the %s tree toolbar", async (viewType) => {
		const showOrder = await renderToolbar({ viewType });
		sortButton().click();

		expect(showOrder).toHaveBeenCalledOnce();
		expect(target.querySelector('[aria-label="Expand limit"]')).not.toBeNull();
		expect(target.querySelector('[aria-label="Search"]')).not.toBeNull();
	});
});
