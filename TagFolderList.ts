import { Menu, TFile, ViewStateResult, WorkspaceLeaf } from "obsidian";
import TagFolderViewComponent from "./TagFolderViewComponent.svelte";
import {
	TagFolderListState,
	TreeItem,
	VIEW_TYPE_TAGFOLDER_LIST
} from "./types";
import { isSpecialTag } from "./util";
import { treeRoot } from "./store";
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

		const expandedTags = this.state.tags
			.map(e => e.split("/")
				.filter(ee => !isSpecialTag(ee))
				.join("/")).filter(e => e != "")
			.map((e) => "#" + e)
			.join(" ")
			.trim();

		//@ts-ignore
		const ww = await this.app.fileManager.createAndOpenMarkdownFile() as TFile;
		await this.app.vault.append(ww, expandedTags);
	}

	getViewType() {
		return VIEW_TYPE_TAGFOLDER_LIST;
	}

	getDisplayText() {
		return `Files with ${this.state.title}`;
	}

	async onOpen() {
		this.component = new TagFolderViewComponent({
			target: this.contentEl,
			props: {
				openfile: this.plugin.focusFile,
				hoverPreview: this.plugin.hoverPreview,
				expandFolder: this.plugin.expandFolder,
				title: "",
				showMenu: this.showMenu,
				showLevelSelect: this.showLevelSelect,
				showOrder: this.showOrder,
				newNote: this.newNote,
				openScrollView: this.plugin.openScrollView,
				items: [],
				isViewSwitchable: this.plugin.settings.useMultiPaneList,
				switchView: this.switchView
			},
		});
	}

	async onClose() {
		this.component.$destroy();
	}

	setTreeRoot(root: TreeItem) {
		treeRoot.set(root);
	}

}