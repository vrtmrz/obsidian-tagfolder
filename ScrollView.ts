import {
	TFile,
	ItemView,
	WorkspaceLeaf, type ViewStateResult
} from "obsidian";
import ScrollViewComponent from "./ScrollViewComponent.svelte";
import {
	type ScrollViewState,
	type ScrollViewFile,
	VIEW_TYPE_SCROLL
} from "types";
import { writable, type Writable } from "svelte/store";
import TagFolderPlugin from "./main";
import { doEvents } from "./util";
import { mount, unmount } from "svelte";

// Show notes as like scroll.
export class ScrollView extends ItemView {

	component?: ReturnType<typeof mount>;
	plugin: TagFolderPlugin;
	icon = "sheets-in-box";
	store: Writable<ScrollViewState>;
	state: ScrollViewState = { files: [], title: "", tagPath: "" };
	title: string = "";
	navigation = true;

	getIcon(): string {
		return "sheets-in-box";
	}

	constructor(leaf: WorkspaceLeaf, plugin: TagFolderPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.store = writable<ScrollViewState>({ files: [], title: "", tagPath: "" });
	}


	getViewType() {
		return VIEW_TYPE_SCROLL;
	}

	getDisplayText() {
		return this.state.tagPath || "Tags scroll";
	}

	async setFile(filenames: ScrollViewFile[]) {
		this.state = { ...this.state, files: filenames };
		await this.updateView();
	}

	async setState(state: ScrollViewState, result: ViewStateResult): Promise<void> {
		this.state = { ...state };
		this.title = state.title;
		await this.updateView();
		result = {
			history: false
		};
		return;
	}

	getState() {
		return this.state;
	}

	isFileOpened(path: string) {
		return this.state.files.some(e => e.path == path);
	}

	getScrollViewState(): ScrollViewState {
		return this.state;
	}

	async updateView() {
		//Load file content
		const items = [] as ScrollViewFile[];
		for (const item of this.state.files) {
			if (item.content) {
				items.push(item);
			} else {
				const f = this.app.vault.getAbstractFileByPath(item.path);
				if (f == null || !(f instanceof TFile)) {
					console.log(`File not found:${item.path}`);
					items.push(item);
					continue;
				}
				const title = this.plugin.getFileTitle(f);
				const w = await this.app.vault.read(f);
				await doEvents();
				item.content = w;
				item.title = title;
				items.push(item);
			}
		}

		this.state = { ...this.state, files: [...items] };
		this.store.set(this.state);
	}

	async onOpen() {
		const app = mount(ScrollViewComponent,
			{
				target: this.contentEl,
				props: {
					store: this.store,
					openfile: this.plugin.focusFile,
					plugin: this.plugin
				},
			});
		this.component = app;
		return await Promise.resolve();
	}

	async onClose() {
		if (this.component) {
			unmount(this.component);
			this.component = undefined;
		}
		return await Promise.resolve();
	}
}
