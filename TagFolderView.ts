import { WorkspaceLeaf } from "obsidian";
import TagFolderViewComponent from "./TagFolderViewComponent.svelte";
import { TreeItem, VIEW_TYPE_TAGFOLDER } from "./types";
import { treeRoot } from "./store";
import TagFolderPlugin from "./main";
import { TagFolderViewBase } from "./TagFolderViewBase";

export class TagFolderView extends TagFolderViewBase {
	icon: "stacked-levels";

	getIcon(): string {
		return "stacked-levels";
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

	newNote(evt: MouseEvent) {
		//@ts-ignore
		this.app.commands.executeCommandById("file-explorer:new-file");
	}
	getViewType() {
		return VIEW_TYPE_TAGFOLDER;
	}

	getDisplayText() {
		return "Tag Folder";
	}

	async onOpen() {
		this.containerEl.empty();
		this.component = new TagFolderViewComponent({
			target: this.containerEl,
			props: {
				openfile: this.plugin.focusFile,
				hoverPreview: this.plugin.hoverPreview,
				expandFolder: this.plugin.expandFolder,
				vaultname: this.app.vault.getName(),
				showMenu: this.showMenu,
				showLevelSelect: this.showLevelSelect,
				showOrder: this.showOrder,
				newNote: this.newNote,
				openScrollView: this.plugin.openScrollView,
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
