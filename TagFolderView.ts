import { WorkspaceLeaf } from "obsidian";
import TagFolderViewComponent from "./TagFolderViewComponent.svelte";
import { VIEW_TYPE_TAGFOLDER } from "./types";
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
				openFile: this.plugin.focusFile,
				hoverPreview: this.plugin.hoverPreview,
				vaultName: this.app.vault.getName(),
				showMenu: this.showMenu,
				showLevelSelect: this.showLevelSelect,
				showOrder: this.showOrder,
				newNote: this.newNote,
				openScrollView: this.plugin.openScrollView,
				isViewSwitchable: this.plugin.settings.useMultiPaneList,
				switchView: this.switchView,
			},
		});
	}

	async onClose() {
		this.component.$destroy();
	}

}
