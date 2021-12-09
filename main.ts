/// <reference types="svelte" />

import {
	App,
	CachedMetadata,
	debounce,
	getAllTags,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	ItemView,
	WorkspaceLeaf,
} from "obsidian";

import TagFolderViewComponent from "./TagFolderViewComponent.svelte";

import { TreeItem, ViewItem } from "types";
import { treeRoot } from "store";

interface TagFolderSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: TagFolderSettings = {
	mySetting: "default",
};

const VIEW_TYPE_TAGFOLDER = "tagfolder-view";

class TagFolderView extends ItemView {
	component: TagFolderViewComponent;
	plugin: TagFolderPlugin;
	icon: "stacked-levels";
	getIcon():string{
		return "stacked-levels";
	}

	constructor(leaf: WorkspaceLeaf, plugin: TagFolderPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_TAGFOLDER;
	}

	getDisplayText() {
		return "Tag Folder";
	}

	async onOpen() {
		this.component = new TagFolderViewComponent({
			target: this.contentEl,
			props: {
				openfile: this.plugin.focusFile,
			},
		});
		this.component.$set({ props: { openFile: this.plugin.focusFile } });
	}

	async onClose() {
		this.component.$destroy();
	}
	setTreeRoot(root: TreeItem) {
		treeRoot.set(root);
	}
}

const sortChildren = (
	a: TreeItem | ViewItem,
	b: TreeItem | ViewItem
): number => {
	if ("tag" in a && !("tag" in b)) {
		return -1;
	} else if (!("tag" in a) && !("tag" in b)) {
		return 1;
	} else {
		if ("tag" in a && "tag" in b) {
			return a.tag.localeCompare(b.tag);
		} else if ("tags" in a && "tags" in b) {
			return a.entry.name.localeCompare(b.entry.name);
		} else {
			return 0;
		}
	}
};

const expandTree = (node: TreeItem, ancestor: string[]) => {
	const tree = node.children;
	const tags = Array.from(
		new Set(
			node.children
				.filter((e) => "tags" in e)
				.map((e) => (e as ViewItem).tags)
				.flat()
		)
	);

	for (const tag of tags) {
		if (ancestor.contains(tag)) continue;
		const newChildrens = node.children.filter(
			(e) => "tags" in e && e.tags.contains(tag)
		);
		if (tree.find((e) => "tag" in e && e.tag == tag)) {
			continue;
		}
		const newLeaf: TreeItem = {
			tag: tag,
			children: newChildrens,
		};
		tree.push(newLeaf);
		expandTree(newLeaf, [...ancestor, tag]);
	}
	tree.sort(sortChildren);
};
const splitTag = (entry: TreeItem) => {
	for (const v of entry.children) {
		if ("tag" in v) {
			splitTag(v);
			if (v.tag.contains("/")) {
				const w = v;
				entry.children.remove(w);
				const tagsArray = v.tag.split("/");
				const tagCar = tagsArray.shift();
				const tagCdr = tagsArray.join("/");
				const parent = entry.children.find(
					(e) => "tag" in e && e.tag == tagCar
				) as TreeItem;
				if (!parent) {
					// console.log("parent missing, create new!");
					const x: TreeItem = {
						tag: tagCar,
						children: [{ tag: tagCdr, children: [...v.children] }],
					};

					entry.children.push(x);
					splitTag(entry);
				} else {
					parent.children.push({
						tag: tagCdr,
						children: [...v.children],
					});
					splitTag(parent);
				}
			}
		}
	}
	entry.children.sort(sortChildren);
};

export default class TagFolderPlugin extends Plugin {
	settings: TagFolderSettings;
	view: TagFolderView;
	readonly focusFile = (path: string): void => {
		const targetFile = this.app.vault
			.getFiles()
			.find((f) => f.path === path);

		if (targetFile) {
			let leaf = this.app.workspace.getMostRecentLeaf();

			const createLeaf = leaf.getViewState().pinned;
			if (createLeaf) {
				leaf = this.app.workspace.createLeafBySplit(leaf);
			}
			leaf.openFile(targetFile);
		}
	};
	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_TAGFOLDER, (leaf) => {
			this.view = new TagFolderView(leaf, this);
			this.loadFileInfo();
			return this.view;
		});
		this.app.workspace.onLayoutReady(async () => {
			// this.activateView();
		});
		this.addCommand({
			id: "tagfolder-open",
			name: "Show Tag Folder",
			callback: () => {
				this.activateView();
			},
		});
		this.metadataCacheChanged = debounce(
			this.metadataCacheChanged.bind(this),
			1000,
			false
		);
		this.registerEvent(
			this.app.metadataCache.on("changed", this.metadataCacheChanged)
		);

		// To prepare.
		// this.addSettingTab(new TabFolderSettingTab(this.app, this));
	}
	metadataCacheChanged(file: TFile) {
		this.loadFileInfo(file);
	}
	fileCaches: {
		file: TFile;
		metadata: CachedMetadata;
	}[] = [];

	// Sweep updated file or all files to retrive tags.
	async loadFileInfo(diff?: TFile) {
		if (this.view == null) return;
		const files = this.app.vault
			.getFiles()
			.filter((e) => e.extension == "md");
		if (this.fileCaches.length == 0 || !diff) {
			this.fileCaches = files.map((e) => {
				return {
					file: e,
					metadata: this.app.metadataCache.getFileCache(e),
				};
			});
		} else {
			this.fileCaches = this.fileCaches.filter(
				(e) => e.file.path != diff.path
			);
			this.fileCaches.push({
				file: diff,
				metadata: this.app.metadataCache.getFileCache(diff),
			});
		}

		const items: ViewItem[] = [];
		for (const f of this.fileCaches) {
			let allTags = getAllTags(f.metadata).map((e) => e.substring(1));
			if (allTags.length == 0) {
				allTags = ["_orphan"];
			}

			items.push({ tags: allTags, entry: f.file });
		}
		const root: TreeItem = {
			tag: "root",
			children: [...items],
		};

		// Expands subfolders in advance.
		expandTree(root, []);

		// Omit orphan items.
		root.children = root.children.filter((e) => "tag" in e);

		// Split tag that having slashes.
		splitTag(root);

		// sort again.
		root.children.sort(sortChildren);

		this.view.setTreeRoot(root);
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TAGFOLDER);
	}
	async activateView() {
		await this.loadFileInfo();
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TAGFOLDER);

		await this.app.workspace.getLeftLeaf(false).setViewState({
			type: VIEW_TYPE_TAGFOLDER,
			active: true,
		});

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(VIEW_TYPE_TAGFOLDER)[0]
		);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class TabFolderSettingTab extends PluginSettingTab {
	plugin: TagFolderPlugin;

	constructor(app: App, plugin: TagFolderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Settings for my awesome plugin." });

		new Setting(containerEl)
			.setName("Setting #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						console.log("Secret: " + value);
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
