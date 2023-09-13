import { Menu, TFile, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import TagFolderViewComponent from "./TagFolderViewComponent.svelte";
import {
	type TagFolderListState,
	VIEW_TYPE_TAGFOLDER_LIST
} from "./types";
import { isSpecialTag, trimTrailingSlash } from "./util";
import TagFolderPlugin from "./main";
import { TagFolderViewBase } from "./TagFolderViewBase";

export class TagFolderList extends TagFolderViewBase {
	component: TagFolderViewComponent;
	plugin: TagFolderPlugin;
	icon: "stacked-levels";
	title: string;

	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);
		menu.addItem(item => {
			item.setIcon("pin")
				.setTitle("Pin")
				.onClick(() => {
					this.leaf.togglePinned();
				})
		})
	}

	getIcon(): string {
		return "stacked-levels";
	}

	state: TagFolderListState = { tags: [], title: "" };

	async setState(state: TagFolderListState, result: ViewStateResult): Promise<void> {
		this.state = { ...state };
		this.title = state.tags.join(",");
		this.component.$set({ tags: state.tags, title: state.title ?? "" })
		result = {};
		return;
	}

	getState() {
		return this.state;
	}

	constructor(leaf: WorkspaceLeaf, plugin: TagFolderPlugin) {
		super(leaf);
		this.plugin = plugin;

		this.showMenu = this.showMenu.bind(this);
		this.showOrder = this.showOrder.bind(this);
		this.newNote = this.newNote.bind(this);
		this.showLevelSelect = this.showLevelSelect.bind(this);
		this.switchView = this.switchView.bind(this);
	}

	async newNote(evt: MouseEvent) {
		await this.plugin.createNewNote(this.state.tags);
	}

	getViewType() {
		return VIEW_TYPE_TAGFOLDER_LIST;
	}

	getDisplayText() {
		return `Files with ${this.state.title}`;
	}

	async onOpen() {
		this.containerEl.empty();
		this.component = new TagFolderViewComponent({
			target: this.containerEl,
			props: {
				openFile: this.plugin.focusFile,
				hoverPreview: this.plugin.hoverPreview,
				title: "",
				showMenu: this.showMenu,
				showLevelSelect: this.showLevelSelect,
				showOrder: this.showOrder,
				newNote: this.newNote,
				openScrollView: this.plugin.openScrollView,
				isViewSwitchable: this.plugin.settings.useMultiPaneList,
				switchView: this.switchView,
				saveSettings: this.saveSettings.bind(this),
			},
		});
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
		}
	}

}
