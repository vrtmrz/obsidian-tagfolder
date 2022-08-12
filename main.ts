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
	TFolder,
	Menu,
	Notice,
	normalizePath,
	parseYaml,
	stringifyYaml,
} from "obsidian";

import TagFolderViewComponent from "./TagFolderViewComponent.svelte";

import {
	SUBTREE_MARK,
	SUBTREE_MARK_REGEX,
	TagFolderItem,
	TreeItem,
	ViewItem,
	TagInfoDict,
	TagInfo,
} from "types";
import { treeRoot, currentFile, maxDepth, tagInfo } from "store";

type DISPLAY_METHOD = "PATH/NAME" | "NAME" | "NAME : PATH";

type HIDE_ITEMS_TYPE = "NONE" | "DEDICATED_INTERMIDIATES" | "ALL_EXCEPT_BOTTOM";

const HideItemsType: Record<string, string> = {
	NONE: "Hide nothing",
	DEDICATED_INTERMIDIATES: "Only intermediates of nested tags",
	ALL_EXCEPT_BOTTOM: "All intermediates",
};

interface TagFolderSettings {
	displayMethod: DISPLAY_METHOD;
	alwaysOpen: boolean;
	ignoreDocTags: string;
	ignoreTags: string;
	ignoreFolders: string;
	hideOnRootTags: string;
	sortType:
	| "DISPNAME_ASC"
	| "DISPNAME_DESC"
	| "NAME_ASC"
	| "NAME_DESC"
	| "MTIME_ASC"
	| "MTIME_DESC"
	| "CTIME_ASC"
	| "CTIME_DESC"
	| "FULLPATH_ASC"
	| "FULLPATH_DESC";
	sortTypeTag: "NAME_ASC" | "NAME_DESC" | "ITEMS_ASC" | "ITEMS_DESC";
	expandLimit: number;
	disableNestedTags: boolean;

	hideItems: HIDE_ITEMS_TYPE;
	scanDelay: number;
	useTitle: boolean;
	reduceNestedParent: boolean;
	frontmatterKey: string;
	useTagInfo: boolean;
	tagInfo: string;
	mergeRedundantCombination: boolean;
}

const DEFAULT_SETTINGS: TagFolderSettings = {
	displayMethod: "NAME",
	alwaysOpen: false,
	ignoreDocTags: "",
	ignoreTags: "",
	hideOnRootTags: "",
	sortType: "DISPNAME_ASC",
	sortTypeTag: "NAME_ASC",
	expandLimit: 0,
	disableNestedTags: false,
	hideItems: "NONE",
	ignoreFolders: "",
	scanDelay: 250,
	useTitle: true,
	reduceNestedParent: true,
	frontmatterKey: "title",
	useTagInfo: false,
	tagInfo: "pininfo.md",
	mergeRedundantCombination: false,
};

const VIEW_TYPE_TAGFOLDER = "tagfolder-view";

const OrderKeyTag: Record<string, string> = {
	NAME: "File name",
	ITEMS: "Count of items",
};
const OrderDirection: Record<string, string> = {
	ASC: "Ascending",
	DESC: "Descending",
};
const OrderKeyItem: Record<string, string> = {
	DISPNAME: "Displaying name",
	NAME: "File name",
	MTIME: "Modified time",
	CTIME: "Created time",
	FULLPATH: "Fullpath of the file",
};

let lastSkipped = 0;
// The messagepump having ancient name.
const doevents = () => {
	const n = performance.now();
	// keep intact the microtask while 20ms
	if (n - lastSkipped < 20) {
		return Promise.resolve();
	}
	// otherwise, run next process after some microtask.
	return new Promise<void>((res) => {
		window.requestAnimationFrame(() => {
			lastSkipped = performance.now();
			res();
		});
	});
};

const dotted = (object: any, notation: string) => {
	return notation.split('.').reduce((a, b) => (a && (b in a)) ? a[b] : null, object);
}

const compare = (Intl && Intl.Collator) ? (new Intl.Collator().compare) :
	(x: string, y: string) => (`${x ?? ""}`).localeCompare(`${y ?? ""}`);

class TagFolderView extends ItemView {
	component: TagFolderViewComponent;
	plugin: TagFolderPlugin;
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
	}

	newNote(evt: MouseEvent) {
		//@ts-ignore
		this.app.commands.executeCommandById("file-explorer:new-file");
	}

	showOrder(evt: MouseEvent) {
		const menu = new Menu(this.app);

		menu.addItem((item) => {
			item.setTitle("Tags")
				.setIcon("hashtag")
				.onClick(async (evt2) => {
					const menu2 = new Menu(this.app);
					for (const key in OrderKeyTag) {
						for (const direction in OrderDirection) {
							menu2.addItem((item) => {
								const newSetting = `${key}_${direction}`;
								item.setTitle(
									OrderKeyTag[key] +
									" " +
									OrderDirection[direction]
								).onClick(async () => {
									//@ts-ignore
									this.plugin.settings.sortTypeTag =
										newSetting;
									await this.plugin.saveSettings();
									this.plugin.setRoot(this.plugin.root);
								});
								if (
									newSetting ==
									this.plugin.settings.sortTypeTag
								) {
									item.setIcon("checkmark");
								}

								menu2.showAtMouseEvent(evt);
								return item;
							});
						}
					}
				});
			return item;
		});
		menu.addItem((item) => {
			item.setTitle("Items")
				.setIcon("document")
				.onClick(async (evt2) => {
					const menu2 = new Menu(this.app);
					for (const key in OrderKeyItem) {
						for (const direction in OrderDirection) {
							menu2.addItem((item) => {
								const newSetting = `${key}_${direction}`;
								item.setTitle(
									OrderKeyItem[key] +
									" " +
									OrderDirection[direction]
								).onClick(async () => {
									//@ts-ignore
									this.plugin.settings.sortType = newSetting;
									await this.plugin.saveSettings();
									this.plugin.setRoot(this.plugin.root);
								});
								if (
									newSetting == this.plugin.settings.sortType
								) {
									item.setIcon("checkmark");
								}

								menu2.showAtMouseEvent(evt);
								return item;
							});
						}
					}
				});
			return item;
		});
		menu.showAtMouseEvent(evt);
	}

	showLevelSelect(evt: MouseEvent) {
		const menu = new Menu(this.app);
		const setLevel = async (level: number) => {
			this.plugin.settings.expandLimit = level;
			await this.plugin.saveSettings();
			maxDepth.set(level);
			this.plugin.setRoot(this.plugin.root);
		};
		for (const level of [2, 3, 4, 5]) {
			menu.addItem((item) => {
				item.setTitle(`Level ${level - 1}`).onClick(() => {
					setLevel(level);
				});
				if (this.plugin.settings.expandLimit == level)
					item.setIcon("checkmark");
				return item;
			});
		}

		menu.addItem((item) => {
			item.setTitle("No limit")
				// .setIcon("hashtag")
				.onClick(() => {
					setLevel(0);
				});
			if (this.plugin.settings.expandLimit == 0)
				item.setIcon("checkmark");

			return item;
		});
		menu.showAtMouseEvent(evt);
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
				hoverPreview: this.plugin.hoverPreview,
				expandFolder: this.plugin.expandFolder,
				vaultname: this.app.vault.getName(),
				showMenu: this.showMenu,
				showLevelSelect: this.showLevelSelect,
				showOrder: this.showOrder,
				newNote: this.newNote,
				setSearchString: this.plugin.setSearchString,
			},
		});
	}

	async onClose() {
		this.component.$destroy();
	}

	setTreeRoot(root: TreeItem) {
		treeRoot.set(root);
	}

	showMenu(evt: MouseEvent, path: string, entry: TagFolderItem) {
		const x = path.replace(SUBTREE_MARK_REGEX, "###");
		const expandedTags = x
			.split("/")
			.filter((e) => e.trim() != "")
			.map((e) => e.replace(/###/g, "/"))
			.map((e) => "#" + e)
			.join(" ")
			.trim();
		const menu = new Menu(this.app);

		if (navigator && navigator.clipboard) {
			menu.addItem((item) =>
				item
					.setTitle(`Copy tags:${expandedTags}`)
					.setIcon("hashtag")
					.onClick(async () => {
						await navigator.clipboard.writeText(expandedTags);
						new Notice("Copied");
					})
			);
		}
		if ("tag" in entry) {
			if (this.plugin.settings.useTagInfo && this.plugin.tagInfo != null) {
				const tag = entry.ancestors[entry.ancestors.length - 1];

				if (tag in this.plugin.tagInfo && this.plugin.tagInfo[tag]) {
					menu.addItem((item) =>
						item.setTitle(`Unpin`)
							.setIcon("pin")
							.onClick(async () => {
								this.plugin.tagInfo =
								{
									...this.plugin.tagInfo,
									[tag]: undefined
								};
								this.plugin.applyTagInfo();
								await this.plugin.saveTagInfo();
							})
					)

				} else {
					menu.addItem((item) => {
						item.setTitle(`Pin`)
							.setIcon("pin")
							.onClick(async () => {
								this.plugin.tagInfo =
								{
									...this.plugin.tagInfo,
									[tag]: { key: "" }
								};
								this.plugin.applyTagInfo();
								await this.plugin.saveTagInfo();
							})
					})
				}
				// menu.addItem((item) =>
				// 	item.setTitle(`Pin`))
			}
		}
		if ("path" in entry) {
			const path = entry.path;
			const file = this.app.vault.getAbstractFileByPath(path);
			// Trigger
			this.app.workspace.trigger(
				"file-menu",
				menu,
				file,
				"file-explorer"
			);
		}

		if ("screenX" in evt) {
			menu.showAtPosition({ x: evt.pageX, y: evt.pageY });
		} else {
			menu.showAtPosition({
				// @ts-ignore
				x: evt.nativeEvent.locationX,
				// @ts-ignore
				y: evt.nativeEvent.locationY,
			});
		}
		// menu.showAtMouseEvent(evt);
	}
}

const rippleDirty = (entry: TreeItem): boolean => {
	// Mark "needs rebuild" itself if the children need to rebuild.
	for (const child of entry.children) {
		if ("tag" in child) {
			if (rippleDirty(child)) {
				entry.descendants = null;
				entry.allDescendants = null;
				entry.descendantsMemo = null;
			}
		}
	}
	if (entry.descendants == null) return true;
};
const retriveAllDecendants = (entry: TagFolderItem): ViewItem[] => {
	return (
		"tag" in entry
			? entry.children.map(
				(e) =>
					"tag" in e
						? [...e.descendants, ...retriveAllDecendants(e)]
						: [e]
				// eslint-disable-next-line no-mixed-spaces-and-tabs
			)
			: [entry]
	).flat() as ViewItem[];
};
const expandDecendants = (
	entry: TreeItem,
	hideItems: HIDE_ITEMS_TYPE
): ViewItem[] => {
	const ret: ViewItem[] = [];
	for (const v of entry.children) {
		if ("tag" in v) {
			if (v.descendants == null) {
				const w = expandDecendants(v, hideItems).filter(
					(e) => !ret.contains(e)
				);
				ret.push(...w);
			} else {
				const w = v.descendants.filter((e) => !ret.contains(e));
				ret.push(...w);
			}
		} else {
			if (!ret.contains(v)) ret.push(v);
		}
	}

	// Find descendants with skipping over children.
	const leafs =
		entry.descendantsMemo != null
			? entry.descendantsMemo // if memo is exists, use it.
			: (entry.descendantsMemo = entry.children // or retrive all and memorize
				.map((e) =>
					"tag" in e
						? e.children
							.map((ee) =>
								retriveAllDecendants(ee).flat()
							)
							.flat()
						: []
				)
				.flat());
	if (
		(hideItems == "DEDICATED_INTERMIDIATES" && entry.isDedicatedTree) ||
		hideItems == "ALL_EXCEPT_BOTTOM"
	) {
		entry.descendants = ret.filter((e) => !leafs.contains(e));
	} else {
		entry.descendants = ret;
	}
	entry.allDescendants = ret;
	entry.itemsCount = new Set([...ret, ...leafs]).size;
	return ret;
};
const expandTree = async (node: TreeItem, reduceNestedParent: boolean): Promise<boolean> => {
	let modified = false;
	const tree = node.children;
	const ancestor = [...node.ancestors, node.tag];
	const tags = Array.from(
		new Set(
			node.children
				.filter((e) => "tags" in e)
				.map((e) => (e as ViewItem).tags)
				.map((e) => e.map((ee) => ee.toLocaleLowerCase()))
				.flat()
		)
	);

	for (const tag of tags) {
		if (
			ancestor
				.map((e) => e.toLocaleLowerCase())
				.contains(tag.toLocaleLowerCase())
		)
			continue;
		const newChildren = node.children.filter(
			(e) =>
				"tags" in e &&
				e.tags
					.map((e) => e.toLocaleLowerCase())
					.contains(tag.toLocaleLowerCase())
		);
		// If already exists in children, skip.
		if (
			tree.find(
				(e) =>
					"tag" in e &&
					e.tag.toLocaleLowerCase() == tag.toLocaleLowerCase()
			)
		) {
			continue;
		}
		const newLeaf: TreeItem = {
			tag: tag,
			children: newChildren,
			ancestors: [...new Set([...ancestor, tag])],
			descendants: null,
			isDedicatedTree: false,
			itemsCount: newChildren.length,
			allDescendants: null,
		};
		tree.push(newLeaf);
		modified = await splitTag(newLeaf, reduceNestedParent);
	}
	modified = await splitTag(node, reduceNestedParent) || modified;
	if (modified) {
		await expandTree(node, reduceNestedParent);
	}
	return modified;
};

const splitTag = async (entry: TreeItem, reduceNestedParent: boolean, root?: TreeItem): Promise<boolean> => {
	let modified = false;
	const xRoot = root || entry;
	await doevents();
	entry.children = entry.children.sort((a, b) => {
		if ("tag" in a && "tag" in b) {
			return a.tag.split("/").length - b.tag.split("/").length;
		} else {
			return 0;
		}
	});
	for (const curEntry of entry.children) {
		if ("tag" in curEntry) {
			modified = (await splitTag(curEntry, reduceNestedParent, xRoot)) || modified;
			if (curEntry.tag.contains("/")) {
				const tempEntry = curEntry;
				entry.children.remove(tempEntry);
				const tagsArray = tempEntry.tag.split("/");
				const tagCar = tagsArray.shift();
				const tagCdr = SUBTREE_MARK + tagsArray.join("/");
				const ancestors = curEntry.ancestors.map(e => e.toLocaleLowerCase());
				const newAncestorsBase = tempEntry.ancestors.filter(e => e != tempEntry.tag);
				const idxCar = ancestors.indexOf(tagCar.toLocaleLowerCase());
				const idxCdr = ancestors.indexOf(tagCdr.toLocaleLowerCase());
				if (idxCar != -1) {

					if (idxCar < idxCdr) {
						// Same condition found.
						// In this case, entry.children can be empty. in that case, we have to snip this entry.
						modified = true;
						continue;
					} else {
						if (reduceNestedParent) {
							// Skip to make parent and expand this immediately.
							modified = true;
							const w: TreeItem = {
								...tempEntry,
								tag: tagCdr,
								ancestors: [
									...newAncestorsBase,
									tagCar,
									tagCdr,
								],
								itemsCount: 0,
								descendants: null,
								allDescendants: null,
								isDedicatedTree: false,
							}
							const old = entry.children.find(e => "tag" in e && e.tag == tagCdr);
							if (old) {
								entry.children.remove(old);
							}
							entry.children.push(w);
							continue;
						}
					}
				}
				const parent = entry.children.find(
					(e) =>
						"tag" in e &&
						e.tag.toLocaleLowerCase() == tagCar.toLocaleLowerCase()
				) as TreeItem;
				const tempChildren = tempEntry.children;
				if (!parent) {
					const xchild: TreeItem = {
						tag: tagCdr,
						children: [...tempChildren],
						ancestors: [
							...newAncestorsBase,
							tagCar,
							tagCdr,
						],
						itemsCount: 0,
						descendants: null,
						allDescendants: null,
						isDedicatedTree: false,
					};
					const x: TreeItem = {
						tag: tagCar,
						children: [xchild],
						ancestors: [...new Set([...newAncestorsBase, tagCar])],
						descendants: null,
						allDescendants: null,
						isDedicatedTree: true,
						itemsCount: 0,
					};
					x.children = [xchild];
					entry.children.push(x);
					await splitTag(entry, reduceNestedParent, xRoot);
					modified = true;
				} else {
					const oldIx = parent.children.find(
						(e) =>
							"tag" in e &&
							e.tag.toLocaleLowerCase() ==
							tagCdr.toLocaleLowerCase()
					) as TreeItem;
					if (oldIx != null) {
						oldIx.children.push(
							...tempChildren.filter(
								(e) => !oldIx.children.contains(e)
							)
						);
						await splitTag(oldIx, reduceNestedParent, xRoot);
					} else {
						const x: TreeItem = {
							tag: tagCdr,
							children: [...tempChildren],
							ancestors: [
								...newAncestorsBase,
								// tempEntry.tag,
								tagCar,
								tagCdr,
							],
							descendants: null,
							allDescendants: null,
							isDedicatedTree: false,
							itemsCount: 0,
						};
						parent.children.push(x);
						if (!parent.isDedicatedTree && !(parent.children.some(e => "tags" in e))) {
							parent.isDedicatedTree = true;
						} else {
							parent.isDedicatedTree = false;
						}
						await splitTag(parent, reduceNestedParent, xRoot);
					}
					modified = true;
				}
			}
		}
	}

	if (modified) {
		modified = await splitTag(entry, reduceNestedParent, xRoot);
	}
	if (modified) {
		// If entry became back as not dedicaded tree, disable it.
		if (entry.isDedicatedTree && entry.children.some(e => "tags" in e)) {
			entry.isDedicatedTree = false;
		}
	}
	return modified;
};
function getTagName(tagName: string, tagInfo: TagInfoDict, invert: number) {
	if (tagInfo == null) return tagName;
	const prefix = invert == -1 ? `\uffff` : `\u0001`;
	const unpinned = invert == 1 ? `\uffff` : `\u0001`;

	if (tagName in tagInfo && tagInfo[tagName]) {
		if ("key" in tagInfo[tagName]) {
			const k = `${prefix}_-${tagInfo[tagName].key}__${tagName}`;
			return k;
		}
	}
	return `${prefix}_${unpinned}_${tagName}`
}
function getCompareMethodTags(settings: TagFolderSettings) {
	const invert = settings.sortTypeTag.contains("_DESC") ? -1 : 1;
	switch (settings.sortTypeTag) {
		case "ITEMS_ASC":
		case "ITEMS_DESC":
			return (a: TreeItem, b: TreeItem, tagInfo: TagInfoDict) =>
				(a.itemsCount - b.itemsCount) * invert;
		case "NAME_ASC":
		case "NAME_DESC":
			return (a: TreeItem, b: TreeItem, tagInfo: TagInfoDict) =>
				compare(getTagName(a.tag, settings.useTagInfo ? tagInfo : null, invert), getTagName(b.tag, settings.useTagInfo ? tagInfo : null, invert)) * invert;
		default:
			console.warn("Compare method (tags) corrupted");
			return (a: TreeItem, b: TreeItem, tagInfo: TagInfoDict) =>
				compare(a.tag, b.tag) * invert;
	}
}

function getCompareMethodItems(settings: TagFolderSettings) {
	const invert = settings.sortType.contains("_DESC") ? -1 : 1;
	switch (settings.sortType) {
		case "DISPNAME_ASC":
		case "DISPNAME_DESC":
			return (a: ViewItem, b: ViewItem) =>
				compare(a.displayName, b.displayName) * invert;
		case "FULLPATH_ASC":
		case "FULLPATH_DESC":
			return (a: ViewItem, b: ViewItem) =>
				compare(a.path, b.path) * invert;
		case "MTIME_ASC":
		case "MTIME_DESC":
			return (a: ViewItem, b: ViewItem) => (a.mtime - b.mtime) * invert;
		case "CTIME_ASC":
		case "CTIME_DESC":
			return (a: ViewItem, b: ViewItem) => (a.ctime - b.ctime) * invert;
		case "NAME_ASC":
		case "NAME_DESC":
			return (a: ViewItem, b: ViewItem) =>
				compare(a.filename, b.filename) * invert;
		default:
			console.warn("Compare method (items) corrupted");
			return (a: ViewItem, b: ViewItem) =>
				compare(a.displayName, b.displayName) * invert;
	}
}

export default class TagFolderPlugin extends Plugin {
	settings: TagFolderSettings;

	// Folder opening status.
	expandedFolders: string[] = ["root"];

	// The Tag Tree.
	root: TreeItem;

	// The File that now opening
	currentOpeningFile = "";

	searchString = "";

	compareItems: (a: ViewItem, b: ViewItem) => number;
	compareTags: (a: TreeItem, b: TreeItem, tagInfo: TagInfoDict) => number;

	getView(): TagFolderView {
		for (const leaf of this.app.workspace.getLeavesOfType(
			VIEW_TYPE_TAGFOLDER
		)) {
			const view = leaf.view;
			if (view instanceof TagFolderView) {
				return view;
			}
		}
		return null;
	}

	// Called when item clicked in the tag folder pane.
	readonly focusFile = (path: string): void => {
		const targetFile = this.app.vault
			.getFiles()
			.find((f) => f.path === path);

		if (targetFile) {
			const leaf = this.app.workspace.getLeaf(false);
			leaf.openFile(targetFile);
		}
	};

	hoverPreview(e: MouseEvent, path: string) {
		this.app.workspace.trigger("hover-link", {
			event: e,
			source: "file-explorer",
			hoverParent: this,
			targetEl: e.target,
			linktext: path,
		});
	}

	setSearchString(search: string) {
		this.searchString = search;
		this.refreshAllTree(null);
	}
	async expandLastExpandedFolders(entry: TagFolderItem, force?: boolean, path: string[] = []) {
		if ("tag" in entry) {
			if (path.indexOf(entry.tag) !== -1) return;
			const key = ([...entry.ancestors]).map(e => e.startsWith(SUBTREE_MARK) ? e.substring(SUBTREE_MARK.length) : e).join("/");
			// console.log(key + "-" + path.map(e => e.tag).join("->"))

			for (const tags of this.expandedFolders) {
				const xtag = [];
				const tagA = tags.split("/");
				for (const f of tagA) {
					xtag.push(f);
					// if (xtag.length == 1) continue;
					const px = xtag.join("/");
					if (key.startsWith(px) || force) {
						await expandTree(entry, this.settings.reduceNestedParent);
						await splitTag(entry, this.settings.reduceNestedParent);
						for (const child of entry.children) {
							if ("tag" in child && path.indexOf(child.tag) == -1) await this.expandLastExpandedFolders(child, false, [...path, entry.tag]);
						}
					}
				}
			}
		}
	}
	// Expand the folder (called from Tag pane.)
	readonly expandFolder = async (entry: TagFolderItem, expanded: boolean) => {
		if ("tag" in entry) {
			const key = [...entry.ancestors, entry.tag].join("/");
			if (expanded) {
				this.expandedFolders = Array.from(
					new Set([...this.expandedFolders, key])
				);
				this.expandedFolders = this.expandedFolders.sort(
					(a, b) => a.split("/").length - b.split("/").length
				);
			} else {
				this.expandedFolders = this.expandedFolders.filter(
					(e) => e != key
				);
			}
			// apply to tree opened status.
			await this.expandLastExpandedFolders(entry);
			// apply to pane.
			this.setRoot(this.root);
		}
	}

	getFileTitle(file: TFile): string {
		if (!this.settings.useTitle) return file.basename;
		const metadata = this.app.metadataCache.getCache(file.path);
		if (metadata.frontmatter && (this.settings.frontmatterKey)) {
			const d = dotted(metadata.frontmatter, this.settings.frontmatterKey);
			if (d) return d;
		}
		if (metadata.headings) {
			const h1 = metadata.headings.find((e) => e.level == 1);
			if (h1) {
				return h1.heading;
			}
		}
		return file.basename;
	}

	getDisplayName(file: TFile): string {
		const filename = this.getFileTitle(file) || file.basename;
		if (this.settings.displayMethod == "NAME") {
			return filename;
		}
		const path = file.path.split("/");
		path.pop();
		const dpath = path.join("/");

		if (this.settings.displayMethod == "NAME : PATH") {
			return `${filename} : ${dpath}`;
		}
		if (this.settings.displayMethod == "PATH/NAME") {
			return `${dpath}/${filename}`;
		}
		return filename;
	}

	async onload() {
		await this.loadSettings();
		this.hoverPreview = this.hoverPreview.bind(this);
		this.sortChildren = this.sortChildren.bind(this);
		this.modifyFile = this.modifyFile.bind(this);
		this.setSearchString = this.setSearchString.bind(this);
		// Make loadFileInfo debonced .
		this.loadFileInfo = debounce(
			this.loadFileInfo.bind(this),
			this.settings.scanDelay,
			true
		);

		this.registerView(
			VIEW_TYPE_TAGFOLDER,
			(leaf) => new TagFolderView(leaf, this)
		);
		this.app.workspace.onLayoutReady(async () => {
			if (this.settings.alwaysOpen) {
				this.activateView();
			}
		});
		this.addCommand({
			id: "tagfolder-open",
			name: "Show Tag Folder",
			callback: () => {
				this.activateView();
			},
		});
		this.metadataCacheChanged = this.metadataCacheChanged.bind(this);
		this.watchWorkspaceOpen = this.watchWorkspaceOpen.bind(this);
		this.registerEvent(
			this.app.metadataCache.on("changed", this.metadataCacheChanged)
		);
		this.refreshAllTree = this.refreshAllTree.bind(this);
		this.registerEvent(this.app.vault.on("rename", this.refreshAllTree));
		this.registerEvent(this.app.vault.on("delete", this.refreshAllTree));
		this.registerEvent(this.app.vault.on("modify", this.modifyFile));

		this.registerEvent(
			this.app.workspace.on("file-open", this.watchWorkspaceOpen)
		);
		this.watchWorkspaceOpen(this.app.workspace.getActiveFile());

		this.addSettingTab(new TagFolderSettingTab(this.app, this));
		maxDepth.set(this.settings.expandLimit);
		if (this.settings.useTagInfo) {
			this.app.workspace.onLayoutReady(async () => {
				await this.loadTagInfo();
			});
		}
	}

	watchWorkspaceOpen(file: TFile) {
		if (file) {
			this.currentOpeningFile = file.path;
		} else {
			this.currentOpeningFile = "";
		}
		currentFile.set(this.currentOpeningFile);
	}

	metadataCacheChanged(file: TFile) {
		this.loadFileInfo(file);
	}

	refreshAllTree(file: TFile | TFolder) {
		this.loadFileInfo();
	}

	fileCaches: {
		file: TFile;
		metadata: CachedMetadata;
	}[] = [];

	sortChildren(a: TreeItem | ViewItem, b: TreeItem | ViewItem) {
		if ("tag" in a && !("tag" in b)) {
			return -1;
		} else if (!("tag" in a) && "tag" in b) {
			return 1;
		} else {
			if ("tag" in a && "tag" in b) {
				return this.compareTags(a, b, this.tagInfo);
			} else if ("tags" in a && "tags" in b) {
				return this.compareItems(a, b);
			} else {
				return 0;
			}
		}
	}

	sortTree(entry: TreeItem) {
		entry.children = entry.children.sort(this.sortChildren);
		for (const child of entry.children) {
			if ("tag" in child) {
				this.sortTree(child);
			}
		}
		entry.descendants = entry.descendants.sort(this.sortChildren);
	}
	snipEmpty(root: TreeItem) {
		for (const v of root.children) {
			if ("tag" in v) this.snipEmpty(v);
		}
		root.children = root.children.filter(e => !("tag" in e && e.children.length == 0));
	}
	mergeRedundantCombination(root: TreeItem) {
		const existenChild = {} as { [key: string]: TreeItem };
		const removeChildren = [] as TreeItem[];
		for (const entry of root.children) {
			if (!("tag" in entry)) continue;
			// snip children's tree first.
			if ("tag" in entry) this.mergeRedundantCombination(entry);
		}
		for (const entry of root.children) {
			// apply only TreeItem
			if (!("tag" in entry)) continue;
			const tags = [...new Set(retriveAllDecendants(entry))].map(e => e.path).sort().join("-");
			if (tags in existenChild) {
				removeChildren.push(entry);
			} else {
				existenChild[tags] = entry;
			}
		}
		for (const v of removeChildren) {
			root.children.remove(v);
		}
		root.children = [...root.children];
	}
	setRoot(root: TreeItem) {
		rippleDirty(root);
		expandDecendants(root, this.settings.hideItems);
		this.snipEmpty(root);
		this.sortTree(root);
		if (this.settings.mergeRedundantCombination) this.mergeRedundantCombination(root);
		this.root = root;
		this.getView()?.setTreeRoot(root);
	}

	oldFileCache = "";

	updateFileCaches(diff?: TFile) {
		if (this.fileCaches.length == 0 || !diff) {
			const files = this.app.vault.getMarkdownFiles();
			this.fileCaches = files.map((fileEntry) => {
				return {
					file: fileEntry,
					metadata: this.app.metadataCache.getFileCache(fileEntry),
				};
			});
		} else {
			this.fileCaches = this.fileCaches.filter(
				(fileCache) => fileCache.file.path != diff.path
			);
			this.fileCaches.push({
				file: diff,
				metadata: this.app.metadataCache.getFileCache(diff),
			});
		}
		const fileCacheDump = JSON.stringify(
			this.fileCaches.map((e) => ({
				path: e.file.path,
				tags: (e.metadata?.tags ?? []).map((e) => e.tag),
			}))
		);
		if (this.oldFileCache == fileCacheDump) {
			return false;
		} else {
			this.oldFileCache = fileCacheDump;
			return true;
		}
	}

	lastTags = "";

	async getItemsList(): Promise<ViewItem[]> {
		const items: ViewItem[] = [];
		const ignoreDocTags = this.settings.ignoreDocTags
			.toLocaleLowerCase()
			.replace(/\n| /g, "")
			.split(",");
		const ignoreTags = this.settings.ignoreTags
			.toLocaleLowerCase()
			.replace(/\n| /g, "")
			.split(",");

		const ignoreFolders = this.settings.ignoreFolders
			.toLocaleLowerCase()
			.replace(/\n/g, "")
			.split(",")
			.map((e) => e.trim())
			.filter((e) => !!e);

		const searchItems = this.searchString
			.toLocaleLowerCase()
			.split("|")
			.map((ee) => ee.split(" ").map((e) => e.trim()));
		for (const fileCache of this.fileCaches) {
			if (
				ignoreFolders.find(
					(e) =>
						e != "" &&
						fileCache.file.path.toLocaleLowerCase().startsWith(e)
				)
			) {
				continue;
			}
			await doevents();
			const allTagsDocs = getAllTags(fileCache.metadata) ?? [];
			let allTags = allTagsDocs.map((e) => e.substring(1));
			if (this.settings.disableNestedTags) {
				allTags = allTags.map((e) => e.split("/")).flat();
			} else {
				// If the circumstance like below:
				// #test
				// #test/child
				// This may make complicated situation. so we have to skip this.
				allTags = allTags.filter(e => !allTags.some(ae => ae.startsWith(e + "/")));
			}
			if (allTags.length == 0) {
				allTags = ["_untagged"];
			}
			if (
				allTags.some((tag) =>
					ignoreDocTags.contains(tag.toLocaleLowerCase())
				)
			) {
				continue;
			}

			// filter the items
			const w = searchItems.map((searchItem) => {
				let bx = false;
				for (const search of searchItem) {
					if (search.startsWith("-")) {
						bx =
							bx ||
							allTags.some((tag) =>
								tag
									.toLocaleLowerCase()
									.contains(search.substring(1))
							);
						if (bx) continue;
					} else {
						bx =
							bx ||
							allTags.every(
								(tag) =>
									!tag.toLocaleLowerCase().contains(search)
							);
						if (bx) continue;
					}
				}
				return bx;
			});

			if (w.every((e) => e)) continue;

			allTags = allTags.filter(
				(tag) => !ignoreTags.contains(tag.toLocaleLowerCase())
			);

			items.push({
				tags: allTags,
				path: fileCache.file.path,
				displayName: this.getDisplayName(fileCache.file),
				ancestors: [],
				mtime: fileCache.file.stat.mtime,
				ctime: fileCache.file.stat.ctime,
				filename: fileCache.file.basename,
			});
		}
		return items;
	}

	async buildUpTree(items: ViewItem[]): Promise<TreeItem> {
		const root: TreeItem = {
			tag: "root",
			children: [...items],
			ancestors: [],
			descendants: null,
			allDescendants: null,
			itemsCount: 0,
			isDedicatedTree: false,
		};

		await expandTree(root, this.settings.reduceNestedParent);

		// Omit items on root
		root.children = root.children.filter((e) => "tag" in e);

		// Split tag that having slashes.
		await splitTag(root, this.settings.reduceNestedParent);
		// restore opened folder
		await this.expandLastExpandedFolders(root, true);
		return root;
	}


	lastSettings = "";
	lastSearchString = "";

	loadFileInfo(diff?: TFile) {
		this.loadFileInfoAsync(diff);
	}

	// Sweep updated file or all files to retrive tags.
	async loadFileInfoAsync(diff?: TFile) {
		if (this.getView() == null) return;
		const strSetting = JSON.stringify(this.settings);
		const isSettingChanged = strSetting != this.lastSettings;
		const isSearchStringModified =
			this.searchString != this.lastSearchString;
		if (isSettingChanged) {
			this.lastSettings = strSetting;
		}
		if (isSearchStringModified) {
			this.lastSearchString = this.searchString;
		}
		if (
			!this.updateFileCaches(diff) &&
			!isSearchStringModified &&
			!isSettingChanged
		) {
			// If any conditions are not changed, skip processing.
			return;
		}

		const items = await this.getItemsList();
		const root = await this.buildUpTree(items);
		this.setRoot(root);

	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TAGFOLDER);
	}

	async activateView() {
		this.loadFileInfo();
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TAGFOLDER);

		await this.app.workspace.getLeftLeaf(false).setViewState({
			type: VIEW_TYPE_TAGFOLDER,
			active: true,
		});

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(VIEW_TYPE_TAGFOLDER)[0]
		);
	}
	tagInfo: TagInfoDict = null;
	tagInfoFrontMatterBuffrer: any = {};
	skipOnce: boolean;
	tagInfoBody = "";
	async modifyFile(file: TFile | TFolder) {
		if (!this.settings.useTagInfo) return;
		if (this.skipOnce) {
			this.skipOnce = false;
			return;
		}
		if (file.name == this.getTagInfoFilename()) {
			await this.loadTagInfo();
		}
	}

	getTagInfoFilename() {
		return normalizePath(this.settings.tagInfo);
	}
	getTagInfoFile() {
		const file = this.app.vault.getAbstractFileByPath(this.getTagInfoFilename());
		if (file instanceof TFile) {
			return file;
		}
		return null;
	}
	applyTagInfo() {
		if (this.tagInfo == null) return;
		if (!this.settings.useTagInfo) return;
		tagInfo.set(this.tagInfo);
		setTimeout(() => {
			if (this.root) this.setRoot(this.root);
		}, 10);
	}
	async loadTagInfo() {
		if (!this.settings.useTagInfo) return;
		if (this.tagInfo == null) this.tagInfo = {};
		const file = this.getTagInfoFile();
		if (file == null) return;
		const data = await this.app.vault.read(file);
		try {
			const bodyStartIndex = data.indexOf("\n---");
			if (!data.startsWith("---") || bodyStartIndex === -1) {
				return;
			}
			const yaml = data.substring(3, bodyStartIndex);
			const yamlData = parseYaml(yaml) as TagInfoDict;

			const keys = Object.keys(yamlData);
			const body = data.substring(bodyStartIndex + 5);
			this.tagInfoBody = body;
			this.tagInfoFrontMatterBuffrer = yamlData;

			const newTagInfo = {} as TagInfoDict;
			for (const key of keys) {
				const w = yamlData[key];
				if (!w) continue;
				if (typeof (w) != "object") continue;
				if (!("key" in w)) continue;
				// snip unexpected entries.
				const eachTag: TagInfo = {
					key: w.key,
					mark: w.mark ?? undefined,
				}
				newTagInfo[key] = eachTag;
			}
			this.tagInfo = newTagInfo;
			this.applyTagInfo();
		} catch (ex) {
			console.log(ex);
			// NO OP.
		}

	}
	async saveTagInfo() {
		if (!this.settings.useTagInfo) return;
		if (this.tagInfo == null) return;
		const file = this.getTagInfoFile();
		const yaml = stringifyYaml({ ...this.tagInfoFrontMatterBuffrer, ...this.tagInfo });
		const w = `---
${yaml}---
${this.tagInfoBody}`;

		this.skipOnce = true;
		if (file == null) {
			this.app.vault.create(this.getTagInfoFilename(), w);
		} else {
			this.app.vault.modify(file, w);
		}
	}
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		await this.loadTagInfo();
		this.compareItems = getCompareMethodItems(this.settings);
		this.compareTags = getCompareMethodTags(this.settings);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		await this.saveTagInfo();
		this.compareItems = getCompareMethodItems(this.settings);
		this.compareTags = getCompareMethodTags(this.settings);
	}
}

class TagFolderSettingTab extends PluginSettingTab {
	plugin: TagFolderPlugin;

	constructor(app: App, plugin: TagFolderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	hide() {
		this.plugin.loadFileInfo();
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Settings for Tag Folder." });

		new Setting(containerEl)
			.setName("Always Open")
			.setDesc("Open Tag Folder when obsidian has been launched")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.alwaysOpen)
					.onChange(async (value) => {
						this.plugin.settings.alwaysOpen = value;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Display method")
			.setDesc("Filename display")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						"PATH/NAME": "PATH/NAME",
						NAME: "NAME",
						"NAME : PATH": "NAME : PATH",
					})
					.setValue(this.plugin.settings.displayMethod)
					.onChange(async (value: DISPLAY_METHOD) => {
						this.plugin.settings.displayMethod = value;
						this.plugin.loadFileInfo(null);
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Use title")
			.setDesc(
				"Use value in the frontmatter or first level one heading for `NAME`."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.useTitle)
					.onChange(async (value) => {
						this.plugin.settings.useTitle = value;
						await this.plugin.saveSettings();
					});
			});
		new Setting(containerEl)
			.setName("Frontmatter path")
			.addText((text) => {
				text
					.setValue(this.plugin.settings.frontmatterKey)
					.onChange(async (value) => {
						this.plugin.settings.frontmatterKey = value;
						await this.plugin.saveSettings();
					});
			});
		new Setting(containerEl)
			.setName("Use pinning")
			.setDesc(
				"When this feature is enabled, the pin information is saved in the file set in the next configuration."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.useTagInfo)
					.onChange(async (value) => {
						this.plugin.settings.useTagInfo = value;
						if (this.plugin.settings.useTagInfo) {
							await this.plugin.loadTagInfo();
						}
						await this.plugin.saveSettings();
					});
			});
		new Setting(containerEl)
			.setName("Pin information file")
			.addText((text) => {
				text
					.setValue(this.plugin.settings.tagInfo)
					.onChange(async (value) => {
						this.plugin.settings.tagInfo = value;
						if (this.plugin.settings.useTagInfo) {
							await this.plugin.loadTagInfo();
						}
						await this.plugin.saveSettings();
					});
			});
		new Setting(containerEl)
			.setName("Merge redundant combinations")
			.setDesc(
				"When this feature is enabled, a/b and b/a are merged into a/b if there is no intermediates."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.mergeRedundantCombination)
					.onChange(async (value) => {
						this.plugin.settings.mergeRedundantCombination = value;
						await this.plugin.saveSettings();
					});
			});
		const setOrderMethod = async (key: string, order: string) => {
			const oldSetting = this.plugin.settings.sortType.split("_");
			if (!key) key = oldSetting[0];
			if (!order) order = oldSetting[1];
			//@ts-ignore
			this.plugin.settings.sortType = `${key}_${order}`;
			await this.plugin.saveSettings();
			this.plugin.setRoot(this.plugin.root);
		};
		const setOrderMethodTag = async (key: string, order: string) => {
			const oldSetting = this.plugin.settings.sortTypeTag.split("_");
			if (!key) key = oldSetting[0];
			if (!order) order = oldSetting[1];
			//@ts-ignore
			this.plugin.settings.sortTypeTag = `${key}_${order}`;
			await this.plugin.saveSettings();
			this.plugin.setRoot(this.plugin.root);
		};
		new Setting(containerEl)
			.setName("Order method (Tags)")
			.setDesc("how to order tags")
			.addDropdown((dd) => {
				dd.addOptions(OrderKeyTag)
					.setValue(this.plugin.settings.sortTypeTag.split("_")[0])
					.onChange((key) => setOrderMethodTag(key, null));
			})
			.addDropdown((dd) => {
				dd.addOptions(OrderDirection)
					.setValue(this.plugin.settings.sortTypeTag.split("_")[1])
					.onChange((order) => setOrderMethodTag(null, order));
			});
		new Setting(containerEl)
			.setName("Order method (Items)")
			.setDesc("how to order items")
			.addDropdown((dd) => {
				dd.addOptions(OrderKeyItem)
					.setValue(this.plugin.settings.sortType.split("_")[0])
					.onChange((key) => setOrderMethod(key, null));
			})
			.addDropdown((dd) => {
				dd.addOptions(OrderDirection)
					.setValue(this.plugin.settings.sortType.split("_")[1])
					.onChange((order) => setOrderMethod(null, order));
			});
		new Setting(containerEl)
			.setName("Do not treat nested tags as dedicated levels")
			.setDesc("Treat nested tags as normal tags")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.disableNestedTags)
					.onChange(async (value) => {
						this.plugin.settings.disableNestedTags = value;
						await this.plugin.saveSettings();
					});
			});
		new Setting(containerEl)
			.setName("Reduce duplicated parents in nested tags")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.reduceNestedParent)
					.onChange(async (value) => {
						this.plugin.settings.reduceNestedParent = value;
						await this.plugin.saveSettings();
					});
			});
		new Setting(containerEl)
			.setName("Hide Items")
			.setDesc("Hide items on the landing or nested tags")
			.addDropdown((dd) => {
				dd.addOptions(HideItemsType)
					.setValue(this.plugin.settings.hideItems)
					.onChange(async (key) => {
						if (
							key == "NONE" ||
							key == "DEDICATED_INTERMIDIATES" ||
							key == "ALL_EXCEPT_BOTTOM"
						) {
							this.plugin.settings.hideItems = key;
						}
						await this.plugin.saveSettings();
					});
			});
		new Setting(containerEl)
			.setName("Ignore note Tag")
			.setDesc(
				"If the note has the tag listed below, the note would be treated as there was not."
			)
			.addTextArea((text) =>
				text
					.setValue(this.plugin.settings.ignoreDocTags)
					.setPlaceholder("test,test1,test2")
					.onChange(async (value) => {
						this.plugin.settings.ignoreDocTags = value;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Ignore Tag")
			.setDesc("Tags in the list would be treated as there were not.")
			.addTextArea((text) =>
				text
					.setValue(this.plugin.settings.ignoreTags)
					.setPlaceholder("test,test1,test2")
					.onChange(async (value) => {
						this.plugin.settings.ignoreTags = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Ignore Folders")
			.setDesc("Ignore documents in specific folders.")
			.addTextArea((text) =>
				text
					.setValue(this.plugin.settings.ignoreFolders)
					.setPlaceholder("template,list/standard_tags")
					.onChange(async (value) => {
						this.plugin.settings.ignoreFolders = value;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Tag scanning delay")
			.setDesc(
				"Sets the delay for reflecting metadata changes to the tag tree. (Plugin reload is required.)"
			)
			.addText((text) => {
				text = text
					.setValue(this.plugin.settings.scanDelay + "")

					.onChange(async (value) => {
						const newDelay = Number.parseInt(value, 10);
						if (newDelay) {
							this.plugin.settings.scanDelay = newDelay;
							await this.plugin.saveSettings();
						}
					});
				text.inputEl.setAttribute("type", "number");
				text.inputEl.setAttribute("min", "250");
				return text;
			});
	}
}
