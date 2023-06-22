/// <reference types="svelte" />

import {
	App,
	CachedMetadata,
	debounce,
	Editor,
	getAllTags,
	MarkdownView,
	normalizePath,
	Notice,
	parseYaml,
	Platform,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
	WorkspaceLeaf,
} from "obsidian";

import {
	DEFAULT_SETTINGS,
	OrderDirection,
	OrderKeyItem,
	OrderKeyTag,
	ScrollViewFile,
	ScrollViewState,
	SUBTREE_MARK,
	TagFolderItem,
	TagFolderListState,
	TagFolderSettings,
	TagInfoDict,
	TreeItem,
	VIEW_TYPE_SCROLL,
	VIEW_TYPE_TAGFOLDER,
	VIEW_TYPE_TAGFOLDER_LIST,
	ViewItem
} from "types";
import { currentFile, maxDepth, searchString, selectedTags, tagFolderSetting, tagInfo } from "store";
import {
	ancestorToTags,
	compare,
	doEvents,
	isAutoExpandTree,
	omittedTags,
	renderSpecialTag,
	secondsToFreshness,
	unique,
} from "./util";
import { ScrollView } from "./ScrollView";
import { TagFolderView } from "./TagFolderView";
import { TagFolderList } from "./TagFolderList";

export type DISPLAY_METHOD = "PATH/NAME" | "NAME" | "NAME : PATH";

// The `Intermidiate` is spelled incorrectly, but it is already used as key of the configuration.
// Leave it to the future.
export type HIDE_ITEMS_TYPE = "NONE" | "DEDICATED_INTERMIDIATES" | "ALL_EXCEPT_BOTTOM";

const HideItemsType: Record<string, string> = {
	NONE: "Hide nothing",
	DEDICATED_INTERMIDIATES: "Only intermediates of nested tags",
	ALL_EXCEPT_BOTTOM: "All intermediates",
};


const dotted = (object: any, notation: string) => {
	return notation.split('.').reduce((a, b) => (a && (b in a)) ? a[b] : null, object);
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
const retrieveAllDescendants = (entry: TagFolderItem): ViewItem[] => {
	return (
		"tag" in entry
			? entry.children.map(
				(e) =>
					"tag" in e
						? [...e.descendants, ...retrieveAllDescendants(e)]
						: [e]
				// eslint-disable-next-line no-mixed-spaces-and-tabs
			)
			: [entry]
	).flat() as ViewItem[];
};
const retrieveChildren = (entry: TagFolderItem): ViewItem[] => {
	return (
		"tag" in entry
			? entry.children.map(
				(e) =>
					"tag" in e
						? [...retrieveChildren(e)]
						: [e]
			)
			: [entry]
	).flat() as ViewItem[];
};
const expandDescendants = (
	entry: TreeItem,
	hideItems: HIDE_ITEMS_TYPE
): ViewItem[] => {
	const ret: ViewItem[] = [];
	for (const v of entry.children) {
		if ("tag" in v) {
			if (v.descendants == null) {
				const w = expandDescendants(v, hideItems).filter(
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
			: (entry.descendantsMemo = [...new Set(entry.children // or retrieve all and memorize
				.map((e) =>
					"tag" in e
						? e.children
							.map((ee) =>
								retrieveAllDescendants(ee).flat()
							)
							.flat()
						: []
				)
				.flat())]);
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
	const ancestor = [...node.ancestors];

	const tags = Array.from(
		new Set(
			node.children
				.filter((e) => "tags" in e)
				.map((e) => (e as ViewItem).tags)
				.flat()
		)
	);
	const ancestorAsTags = ancestorToTags(ancestor);
	for (const tag of tags) {
		if (
			ancestorAsTags
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
			extraTags: node.extraTags,
			children: newChildren,
			ancestors: [...ancestor, tag],
			descendants: null,
			isDedicatedTree: false,
			itemsCount: newChildren.length,
			allDescendants: null,
		};
		tree.push(newLeaf);
		// modified = await splitTag(newLeaf, reduceNestedParent);
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
	await doEvents();
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
							const replacer: TreeItem = {
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
								isDedicatedTree: tempEntry.isDedicatedTree,
							}
							// Look up for the entry which to be removed.
							const old = entry.children.find(e => "tag" in e && e.tag == tagCdr) as null | TreeItem;
							if (old) {
								entry.children.remove(old);
								// Merge children into new entry.
								replacer.children = [...replacer.children, ...old.children]
							}
							entry.children.push(replacer);
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
					const newGrandchild: TreeItem = {
						tag: tagCdr,
						extraTags: tempEntry.extraTags,//?
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
					const newChild: TreeItem = {
						tag: tagCar,
						extraTags: tempEntry.extraTags,//?
						children: [newGrandchild],
						ancestors: [...newAncestorsBase, tagCar],
						descendants: null,
						allDescendants: null,
						isDedicatedTree: true,
						itemsCount: 0,
					};
					newChild.children = [newGrandchild];
					entry.children.push(newChild);
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
							extraTags: tempEntry.extraTags,//?
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
						// If it was dedicated tree, check all children are still inside.
						// For cases as below:
						// (Before) 
						//  A
						//  +-> B
						//      + DOC 1
						// (After)
						//   A
						//   +-B        <-- This level should be back to normal tree.
						//   | +DOC 1
						//   +-DOC 2
						if (!parent.isDedicatedTree) {
							const p = retrieveChildren(parent).map(e => e.path)
							const c = retrieveChildren(tempEntry).map(e => e.path);
							if (c.some(entry => !p.contains(entry))) {
								parent.isDedicatedTree = false;
							} else {
								parent.isDedicatedTree = true;
							}
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
		// If entry became back as not dedicated tree, disable it.
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
			return `${prefix}_-${tagInfo[tagName].key}__${tagName}`;
		}
	}
	return `${prefix}_${unpinned}_${tagName}`
}

function getCompareMethodTags(settings: TagFolderSettings) {
	const invert = settings.sortTypeTag.contains("_DESC") ? -1 : 1;
	switch (settings.sortTypeTag) {
		case "ITEMS_ASC":
		case "ITEMS_DESC":
			return (a: TreeItem, b: TreeItem, tagInfo: TagInfoDict) => {
				const aCount = a.itemsCount - ((settings.useTagInfo && (a.tag in tagInfo && "key" in tagInfo[a.tag])) ? 100000 * invert : 0);
				const bCount = b.itemsCount - ((settings.useTagInfo && (b.tag in tagInfo && "key" in tagInfo[b.tag])) ? 100000 * invert : 0);
				return (aCount - bCount) * invert;
			}
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

// Thank you @pjeby!
function onElement<T extends HTMLElement | Document>(el: T, event: string, selector: string, callback: any, options: EventListenerOptions) {
	//@ts-ignore
	el.on(event, selector, callback, options)
	//@ts-ignore
	return () => el.off(event, selector, callback, options);
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
	readonly focusFile = (path: string, specialKey: boolean): void => {
		const targetFile = this.app.vault
			.getFiles()
			.find((f) => f.path === path);

		if (targetFile) {
			if (specialKey) {
				app.workspace.openLinkText(targetFile.path, targetFile.path, "split");
			} else {
				// const leaf = this.app.workspace.getLeaf(false);
				// leaf.openFile(targetFile);
				app.workspace.openLinkText(targetFile.path, targetFile.path);
			}
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
		searchString.set(search);
	}

	async expandLastExpandedFolders(entry: TagFolderItem, force?: boolean, path: string[] = [], openedTags: { [key: string]: Set<string> } = {}, maxDepth = 1) {
		if (maxDepth < 0) {
			return;
		}
		if ("tag" in entry) {
			if (path.indexOf(entry.tag) !== -1) return;
			if (omittedTags(entry, this.settings)) return;
			const key = entry.ancestors.join("/");
			for (const tags of this.expandedFolders) {
				const tagPrefixToOpen = [];
				const tagArray = tags.split("/");
				for (const f of tagArray) {
					tagPrefixToOpen.push(f);
					const tagPrefix: string = tagPrefixToOpen.join("/");
					if (!(tagPrefix in openedTags)) {
						openedTags[tagPrefix] = new Set();
					}
					if (openedTags[tagPrefix].has(key)) {
						continue;
					}
					if (key.startsWith(tagPrefix) || force) {
						openedTags[tagPrefix].add(key);
						await expandTree(entry, this.settings.reduceNestedParent);
						await splitTag(entry, this.settings.reduceNestedParent);

						for (const child of entry.children) {
							if ("tag" in child) {
								const autoExp = isAutoExpandTree(child, this.settings);
								const nextDepth = (autoExp || child.isDedicatedTree) ? maxDepth : maxDepth - 1;
								if (path.indexOf(child.tag) == -1) {
									await this.expandLastExpandedFolders(child, false, [...path, entry.tag], openedTags, nextDepth);
								}
							}
						}
					}
				}
			}
		}
	}

	// Expand the folder (called from Tag pane.)
	readonly expandFolder = async (entry: TagFolderItem, expanded: boolean) => {
		if ("tag" in entry) {
			const key = [...entry.ancestors].join("/");
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
		const displayPath = path.join("/");

		if (this.settings.displayMethod == "NAME : PATH") {
			return `${filename} : ${displayPath}`;
		}
		if (this.settings.displayMethod == "PATH/NAME") {
			return `${displayPath}/${filename}`;
		}
		return filename;
	}

	async onload() {
		await this.loadSettings();
		this.hoverPreview = this.hoverPreview.bind(this);
		this.sortChildren = this.sortChildren.bind(this);
		this.modifyFile = this.modifyFile.bind(this);
		this.setSearchString = this.setSearchString.bind(this);
		this.openScrollView = this.openScrollView.bind(this);
		// Make loadFileInfo debounced .
		this.loadFileInfo = debounce(
			this.loadFileInfo.bind(this),
			this.settings.scanDelay,
			true
		);

		this.registerView(
			VIEW_TYPE_TAGFOLDER,
			(leaf) => new TagFolderView(leaf, this)
		);
		this.registerView(
			VIEW_TYPE_TAGFOLDER_LIST,
			(leaf) => new TagFolderList(leaf, this)
		);
		this.registerView(
			VIEW_TYPE_SCROLL,
			(leaf) => new ScrollView(leaf, this)
		);
		this.app.workspace.onLayoutReady(async () => {
			await this.initView();
			if (this.settings.alwaysOpen) {
				await this.activateView();
			}
		});
		this.addCommand({
			id: "tagfolder-open",
			name: "Show Tag Folder",
			callback: () => {
				this.activateView();
			},
		});
		this.addCommand({
			id: "tagfolder-create-similar",
			name: "Create a new note with the same tags",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const tags = getAllTags(this.app.metadataCache.getFileCache(view.file));
				//@ts-ignore
				const ww = await this.app.fileManager.createAndOpenMarkdownFile() as TFile;
				await this.app.vault.append(ww, tags.join(" "));
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
		searchString.subscribe((search => {
			this.searchString = search;
			this.refreshAllTree(null);
		}))


		const setTagSearchString = (event: MouseEvent, tagString: string) => {
			if (tagString) {
				const regExpTagStr = new RegExp(`(^|\\s)${tagString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, "u");
				const regExpTagStrInv = new RegExp(`(^|\\s)-${tagString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, "u");
				if (event.altKey) {
					return;
				} else if (event.ctrlKey && event.shiftKey) {
					if (this.searchString.match(regExpTagStr)) {
						this.setSearchString(this.searchString.replace(regExpTagStr, ""));
					} else if (!this.searchString.match(regExpTagStrInv)) {
						this.setSearchString(this.searchString + (this.searchString.length == 0 ? "" : " ") + `-${tagString}`);
					}
				} else if (event.ctrlKey) {
					if (this.searchString.match(regExpTagStrInv)) {
						this.setSearchString(this.searchString.replace(regExpTagStrInv, ""));
					} else if (!this.searchString.match(regExpTagStr)) {
						this.setSearchString(this.searchString + (this.searchString.length == 0 ? "" : " ") + `${tagString}`);
					}
				} else {
					this.setSearchString(tagString);

				}
				event.preventDefault();
				event.stopPropagation();

			}
		}

		const selectorHashTagLink = 'a.tag[href^="#"]';
		const selectorHashTagSpan = "span.cm-hashtag.cm-meta";
		this.register(
			onElement(document, "click", selectorHashTagLink, (event: MouseEvent, targetEl: HTMLElement) => {
				if (!this.settings.overrideTagClicking) return;
				const tagString = targetEl.innerText.substring(1);
				if (tagString) {
					setTagSearchString(event, tagString);
				}
			}, { capture: true })
		);
		this.register(
			onElement(document, "click", selectorHashTagSpan, (event: MouseEvent, targetEl: HTMLElement) => {
				if (!this.settings.overrideTagClicking) return;
				let enumTags: Element = targetEl;
				let tagString = "";
				// A tag is consisted of possibly several spans having each class.
				// Usually, they have been merged into two spans. but can be more.
				// In any event, the first item has `cm-hashtag-begin`, and the last
				// item has `cm-hashtag-end` but both (or all) spans possibly raises events.
				// So we have to find the head and trace them to the tail.
				while (!enumTags.classList.contains("cm-hashtag-begin")) {
					enumTags = enumTags.previousElementSibling;
					if (!enumTags) {
						console.log("Error! start tag not found.");
						return;
					}
				}

				do {
					if (enumTags instanceof HTMLElement) {
						tagString += enumTags.innerText;
						if (enumTags.classList.contains("cm-hashtag-end")) {
							break;
						}
					}
					enumTags = enumTags.nextElementSibling;

				} while (enumTags);
				tagString = tagString.substring(1) //Snip hash.
				setTagSearchString(event, tagString);
			}, { capture: true })
		);
		selectedTags.subscribe(newTags => {
			this.openListView(newTags)
		})
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
		const existentChild = {} as { [key: string]: TreeItem };
		const removeChildren = [] as TreeItem[];
		for (const entry of root.children) {
			if (!("tag" in entry)) continue;
			// snip children's tree first.
			if ("tag" in entry) this.mergeRedundantCombination(entry);
		}
		for (const entry of root.children) {
			// apply only TreeItem
			if (!("tag" in entry)) continue;
			const tags = [...new Set(retrieveAllDescendants(entry))].map(e => e.path).sort().join("-");
			if (tags in existentChild) {
				removeChildren.push(entry);
			} else {
				existentChild[tags] = entry;
			}
		}
		for (const v of removeChildren) {
			root.children.remove(v);
		}
		root.children = [...root.children];
	}

	setRoot(root: TreeItem) {
		rippleDirty(root);
		expandDescendants(root, this.settings.hideItems);
		this.snipEmpty(root);
		this.sortTree(root);
		if (this.settings.mergeRedundantCombination) this.mergeRedundantCombination(root);
		if (this.settings.expandUntaggedToRoot) {
			const untagged = root?.children?.find(e => "tag" in e && e.tag == "_untagged") as TreeItem;
			if (untagged) {
				root.children.push(...untagged.allDescendants.map(e => ({ ...e, tags: [] })));
				root.children.remove(untagged);
			}
		}
		this.root = root;
		this.getView()?.setTreeRoot(root);
	}

	oldFileCache = "";

	updateFileCaches(diff?: TFile) {
		if (this.fileCaches.length == 0 || !diff) {
			const files = [...this.app.vault.getMarkdownFiles(), ...this.app.vault.getAllLoadedFiles().filter(e => "extension" in e && e.extension == "canvas") as TFile[]];
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
				tags: getAllTags(e.metadata),
			}))
		);
		if (this.oldFileCache == fileCacheDump) {
			return false;
		} else {
			this.oldFileCache = fileCacheDump;
			return true;
		}
	}

	async getItemsList(): Promise<ViewItem[]> {
		const items: ViewItem[] = [];
		const ignoreDocTags = this.settings.ignoreDocTags
			.toLocaleLowerCase()
			.replace(/[\n ]/g, "")
			.split(",");
		const ignoreTags = this.settings.ignoreTags
			.toLocaleLowerCase()
			.replace(/[\n ]/g, "")
			.split(",");

		const ignoreFolders = this.settings.ignoreFolders
			.toLocaleLowerCase()
			.replace(/\n/g, "")
			.split(",")
			.map((e) => e.trim())
			.filter((e) => !!e);
		const targetFolders = this.settings.targetFolders
			.toLocaleLowerCase()
			.replace(/\n/g, "")
			.split(",")
			.map((e) => e.trim())
			.filter((e) => !!e);


		const searchItems = this.searchString
			.toLocaleLowerCase()
			.split("|")
			.map((ee) => ee.split(" ").map((e) => e.trim()));


		const today = Date.now();
		const archiveTags = this.settings.archiveTags
			.toLocaleLowerCase()
			.replace(/[\n ]/g, "")
			.split(",");

		for (const fileCache of this.fileCaches) {
			if (
				targetFolders.length > 0 &&
				!targetFolders.some(
					(e) => {
						return e != "" &&
							fileCache.file.path.toLocaleLowerCase().startsWith(e)
					}
				)
			) {
				continue;
			}
			if (
				ignoreFolders.some(
					(e) =>
						e != "" &&
						fileCache.file.path.toLocaleLowerCase().startsWith(e)
				)
			) {
				continue;
			}
			await doEvents();
			const tagRedirectList = {} as { [key: string]: string };
			if (this.settings.useTagInfo && this.tagInfo) {
				for (const [key, taginfo] of Object.entries(this.tagInfo)) {
					if ("redirect" in taginfo) {
						tagRedirectList[key] = taginfo.redirect;
					}
				}
			}
			const allTagsDocs = unique(getAllTags(fileCache.metadata) ?? []);
			let allTags = unique(allTagsDocs.map((e) => e.substring(1)).map(e => e in tagRedirectList ? tagRedirectList[e] : e));
			if (this.settings.disableNestedTags) {
				allTags = allTags.map((e) => e.split("/")).flat();
			}
			if (allTags.length == 0) {
				allTags = ["_untagged"];
			}
			if (fileCache.file.extension == "canvas") {
				allTags.push("_VIRTUAL_TAG_CANVAS")
			}
			if (this.settings.useVirtualTag) {
				const mtime = fileCache.file.stat.mtime;
				const diff = today - mtime
				const disp = secondsToFreshness(diff);
				allTags.push(`_VIRTUAL_TAG_FRESHNESS/${disp}`);
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
				if (allTags.length == 0) return false;
				for (const search of searchItem) {
					if (search.startsWith("-")) {
						bx =
							bx ||
							allTags.some((tag) =>
								tag
									.toLocaleLowerCase()
									.contains(search.substring(1))
							);
						// if (bx) continue;
					} else {
						bx =
							bx ||
							allTags.every(
								(tag) =>
									!tag.toLocaleLowerCase().contains(search)
							);
						// if (bx) continue;
					}
				}
				return bx;
			});

			if (w.every((e) => e)) continue;

			allTags = allTags.filter(
				(tag) => !ignoreTags.contains(tag.toLocaleLowerCase())
			);
			if (this.settings.disableNarrowingDown) {
				const archiveTagsMatched = allTags.filter(e => archiveTags.contains(e.toLocaleLowerCase()));
				const targetTags = archiveTagsMatched.length == 0 ? allTags : archiveTagsMatched;
				for (const tags of targetTags) {
					items.push({
						tags: [tags],
						extraTags: allTags.filter(e => e != tags),
						path: fileCache.file.path,
						displayName: this.getDisplayName(fileCache.file),
						ancestors: [],
						mtime: fileCache.file.stat.mtime,
						ctime: fileCache.file.stat.ctime,
						filename: fileCache.file.basename,
					});
				}
			} else {
				items.push({
					tags: allTags,
					extraTags: [],
					path: fileCache.file.path,
					displayName: this.getDisplayName(fileCache.file),
					ancestors: [],
					mtime: fileCache.file.stat.mtime,
					ctime: fileCache.file.stat.ctime,
					filename: fileCache.file.basename,
				});
			}
		}
		return items;
	}

	async buildUpTree(items: ViewItem[]): Promise<TreeItem> {

		// Pick notes which tagged with archiveTags
		const archiveTags = this.settings.archiveTags
			.toLocaleLowerCase()
			.replace(/[\n ]/g, "")
			.split(",");

		const archivedNotes = archiveTags.map(archiveTag => ([archiveTag, items.filter(item => item.tags.some(tag => tag.toLocaleLowerCase() == archiveTag))])) as [string, ViewItem[]][]
		const root: TreeItem = {
			tag: "root",
			extraTags: [],
			children: [...items.filter(e => e.tags.every(tag => !archiveTags.contains(tag.toLocaleLowerCase())))],
			ancestors: ["root"],
			descendants: null,
			allDescendants: null,
			itemsCount: 0,
			isDedicatedTree: false,
		};
		// Make branches of archived tags.

		for (const [archiveTag, items] of archivedNotes) {
			root.children.push(
				{
					extraTags: [],
					tag: archiveTag,
					children: items,
					ancestors: ["root", archiveTag],
					descendants: null,
					allDescendants: null,
					itemsCount: 0,
					isDedicatedTree: false,
				}
			)
		}

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
		this.loadFileInfoAsync(diff).then(e => {
			/* NO op*/
		});
	}

	// Sweep updated file or all files to retrieve tags.
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
			await this.applyUpdateIntoScroll(diff);
			return;
		}

		const items = await this.getItemsList();
		const root = await this.buildUpTree(items);
		this.setRoot(root);
		await this.applyUpdateIntoScroll(diff);

	}

	onunload() { }

	async openScrollView(leaf: WorkspaceLeaf, title: string, tagPath: string, files: string[]) {
		if (!leaf) {
			leaf = this.app.workspace.getLeaf("split");
		}
		// this.app.workspace.create
		await leaf.setViewState({
			type: VIEW_TYPE_SCROLL,
			active: true,
			state: { files: files.map(e => ({ path: e })), title: title, tagPath: tagPath } as ScrollViewState
		});

		this.app.workspace.revealLeaf(
			leaf
		);
	}

	findTreeItemFromPath(tagPath: string, root?: TreeItem): TreeItem | null {
		// debugger;
		if (!root) {
			root = this.root;
		}

		//If this is the bottom, return.
		if (root.children.some(e => !("tag" in e))) {
			return root;
		}
		const paths = tagPath.split("/");
		paths.shift();
		const path = [] as string[];

		while (paths.length > 0) {
			path.push(paths.shift());
			const child = root.children.find(e => "tag" in e && e.tag == path.join("/")) as TreeItem;
			if (child) {
				return this.findTreeItemFromPath(paths.join("/"), child);
			}
		}
		return null;
	}


	async applyUpdateIntoScroll(file?: TFile) {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SCROLL);
		for (const leaf of leaves) {
			const view = leaf.view as ScrollView;
			const viewStat = { ...leaf.getViewState(), state: { ...view.getScrollViewState() } }
			if (file && view.isFileOpened(file.path)) {

				const newStat = {
					...viewStat,
					state: {
						...viewStat.state,
						files: viewStat.state.files.map(e => e.path == file.path ? ({
							path: file.path
						} as ScrollViewFile) : e)

					}
				}
				await leaf.setViewState(newStat);
			}
			// Check files that included in the Scroll view.
			const openedNode = this.findTreeItemFromPath(viewStat.state.tagPath);
			if (openedNode) {
				const newFilesArray = openedNode.allDescendants.map(e => e.path);
				const newFiles = newFilesArray.sort().join("-");
				const oldFiles = viewStat.state.files.map(e => e.path).sort().join("-");
				if (newFiles != oldFiles) {
					// List has changed
					const newStat = {
						...viewStat,
						state: {
							...viewStat.state,
							files: newFilesArray.map(path => {
								const old = viewStat.state.files.find(e => e.path == path);
								if (old) return old;
								return {
									path: path
								} as ScrollViewFile;


							}) as ScrollViewFile[]
						}
					}
					await leaf.setViewState(newStat);
				}
			}
		}

	}

	async initView() {
		this.loadFileInfo();
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TAGFOLDER);
		if (leaves.length == 0) {
			await this.app.workspace.getLeftLeaf(false).setViewState({
				type: VIEW_TYPE_TAGFOLDER,
				active: true,
			});
		} else {
			leaves[0].setViewState({
				type: VIEW_TYPE_TAGFOLDER,
				active: true,
			})
		}
	}

	async activateView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TAGFOLDER);
		await this.initView();
		if (leaves.length > 0) {
			this.app.workspace.revealLeaf(
				leaves[0]
			);
		}

	}

	tagInfo: TagInfoDict = null;
	tagInfoFrontMatterBuffer: any = {};
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
			this.tagInfoBody = data.substring(bodyStartIndex + 5);
			this.tagInfoFrontMatterBuffer = yamlData;

			const newTagInfo = {} as TagInfoDict;
			for (const key of keys) {
				const w = yamlData[key];
				if (!w) continue;
				if (typeof (w) != "object") continue;
				// snip unexpected keys
				// but we can use xkey, xmark or something like that for preserving entries.
				const keys = ["key", "mark", "alt", "redirect"];
				const entries = Object.entries(w).filter(([key]) => keys.some(e => key.contains(e)));
				if (entries.length == 0) continue;
				newTagInfo[key] = Object.fromEntries(entries);
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
		let file = this.getTagInfoFile();
		if (file == null) {
			file = await this.app.vault.create(this.getTagInfoFilename(), "");
		}
		await app.fileManager.processFrontMatter(file, matter => {
			const ti = Object.entries(this.tagInfo);
			for (const [key, value] of ti) {
				if (value === undefined) {
					delete matter[key];
				} else {
					matter[key] = value;
				}
			}
		});
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		await this.loadTagInfo();
		tagFolderSetting.set(this.settings);
		this.compareItems = getCompareMethodItems(this.settings);
		this.compareTags = getCompareMethodTags(this.settings);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		await this.saveTagInfo();
		tagFolderSetting.set(this.settings);
		this.compareItems = getCompareMethodItems(this.settings);
		this.compareTags = getCompareMethodTags(this.settings);
	}

	async openListView(tagSrc: string[]) {
		if (!tagSrc) return;
		const tags = tagSrc.first() == "root" ? tagSrc.slice(1) : tagSrc;

		let theLeaf: WorkspaceLeaf;
		for (const leaf of this.app.workspace.getLeavesOfType(
			VIEW_TYPE_TAGFOLDER_LIST
		)) {
			const state = leaf.getViewState();
			if (state.state.tags.slice().sort().join("-") == tags.slice().sort().join("-")) {
				// already shown.
				this.app.workspace.setActiveLeaf(leaf, { focus: true });
				return;
			}
			if (state.pinned) {
				// NO OP.
			} else {
				theLeaf = leaf
			}
		}
		if (!theLeaf) {
			const parent = this.app.workspace.getLeavesOfType(VIEW_TYPE_TAGFOLDER)?.first();
			if (!parent) {
				// Cancel if the tagfolder has been disappeared.
				return;
			}
			if (!Platform.isMobile) {
				theLeaf = this.app.workspace.createLeafBySplit(parent, "horizontal", false);
			} else {
				theLeaf = this.app.workspace.getLeftLeaf(false);
			}
		}
		const title = tags.map((e) =>
			e
				.split("/")
				.map((ee) => renderSpecialTag(ee))
				.join("/")
		).join(" ");
		await theLeaf.setViewState({
			type: VIEW_TYPE_TAGFOLDER_LIST,
			active: true,
			state: { tags: tags, title: title } as TagFolderListState
		});
		(theLeaf.view as TagFolderList).setTreeRoot(this.root);

		this.app.workspace.revealLeaf(
			theLeaf
		);
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

		containerEl.createEl("h2", { text: "Settings for TagFolder" });


		containerEl.createEl("h3", { text: "Behavior" });
		new Setting(containerEl)
			.setName("Always Open")
			.setDesc("Place TagFolder on the left pane and activate it at every Obsidian launch")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.alwaysOpen)
					.onChange(async (value) => {
						this.plugin.settings.alwaysOpen = value;
						await this.plugin.saveSettings();
					})
			);
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
						pi.setDisabled(!value);
					});
			});
		const pi = new Setting(containerEl)
			.setName("Pin information file")
			.setDisabled(!this.plugin.settings.useTagInfo)
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
			.setName("Disable narrowing down")
			.setDesc(
				"When this feature is enabled, relevant tags will be shown with the title instead of making a sub-structure."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.disableNarrowingDown)
					.onChange(async (value) => {
						this.plugin.settings.disableNarrowingDown = value;
						await this.plugin.saveSettings();
					});
			});
		containerEl.createEl("h3", { text: "Files" });
		new Setting(containerEl)
			.setName("Display method")
			.setDesc("How to show a title of files")
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
		const setOrderMethod = async (key: string, order: string) => {
			const oldSetting = this.plugin.settings.sortType.split("_");
			if (!key) key = oldSetting[0];
			if (!order) order = oldSetting[1];
			//@ts-ignore
			this.plugin.settings.sortType = `${key}_${order}`;
			await this.plugin.saveSettings();
			this.plugin.setRoot(this.plugin.root);
		};
		new Setting(containerEl)
			.setName("Order method")
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
			.setName("Use title")
			.setDesc(
				"Use value in the frontmatter or first level one heading for `NAME`."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.useTitle)
					.onChange(async (value) => {
						this.plugin.settings.useTitle = value;
						fpath.setDisabled(!value);
						await this.plugin.saveSettings();
					});
			});
		const fpath = new Setting(containerEl)
			.setName("Frontmatter path")
			.setDisabled(!this.plugin.settings.useTitle)
			.addText((text) => {
				text
					.setValue(this.plugin.settings.frontmatterKey)
					.onChange(async (value) => {
						this.plugin.settings.frontmatterKey = value;
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("h3", { text: "Tags" });

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
			.setName("Order method")
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
			.setName("Use virtual tags")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.useVirtualTag)
					.onChange(async (value) => {
						this.plugin.settings.useVirtualTag = value;
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("h3", { text: "Actions" });
		new Setting(containerEl)
			.setName("Search tags inside TagFolder when clicking tags")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.overrideTagClicking)
					.onChange(async (value) => {
						this.plugin.settings.overrideTagClicking = value;
						await this.plugin.saveSettings();
					});
			});
		new Setting(containerEl)
			.setName("List files in a separated pane")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.useMultiPaneList)
					.onChange(async (value) => {
						this.plugin.settings.useMultiPaneList = value;
						await this.plugin.saveSettings();
					});
			});
		containerEl.createEl("h3", { text: "Arrangements" });

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
		new Setting(containerEl)
			.setName("Do not simplify empty folders")
			.setDesc(
				"Keep empty folders, even if they can be simplified."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.doNotSimplifyTags)
					.onChange(async (value) => {
						this.plugin.settings.doNotSimplifyTags = value;
						await this.plugin.saveSettings();
					});
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
			.setDesc("If enabled, #web/css, #web/javascript will merged into web -> css -> javascript")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.reduceNestedParent)
					.onChange(async (value) => {
						this.plugin.settings.reduceNestedParent = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Keep untagged items on the root")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.expandUntaggedToRoot)
					.onChange(async (value) => {
						this.plugin.settings.expandUntaggedToRoot = value;
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("h3", { text: "Filters" });
		new Setting(containerEl)
			.setName("Target Folders")
			.setDesc("If configured, the plugin will only target files in it.")
			.addTextArea((text) =>
				text
					.setValue(this.plugin.settings.targetFolders)
					.setPlaceholder("study,documents/summary")
					.onChange(async (value) => {
						this.plugin.settings.targetFolders = value;
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
			.setName("Archive tags")
			.setDesc("If configured, notes with these tags will be moved under the tag.")
			.addTextArea((text) =>
				text
					.setValue(this.plugin.settings.archiveTags)
					.setPlaceholder("archived, discontinued")
					.onChange(async (value) => {
						this.plugin.settings.archiveTags = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h3", { text: "Misc" });

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

		containerEl.createEl("h3", { text: "Utilities" });

		new Setting(containerEl)
			.setName("Dumping tags for reporting bugs")
			.setDesc(
				"If you want to open an issue to the GitHub, this information can be useful. and, also if you want to keep secrets about names of tags, you can use `disguised`."
			)
			.addButton((button) =>
				button
					.setButtonText("Copy tags")
					.setDisabled(false)
					.onClick(async () => {
						const items = this.plugin.root.allDescendants.map(e => e.tags.filter(e => e != "_untagged")).filter(e => e.length);
						await navigator.clipboard.writeText(items.map(e => e.map(e => `#${e}`).join(", ")).join("\n"));
						new Notice("Copied to clipboard");
					}))
			.addButton((button) =>
				button
					.setButtonText("Copy disguised tags")
					.setDisabled(false)
					.onClick(async () => {
						const x = new Map<string, number>();
						let i = 0;
						const items = this.plugin.root.allDescendants.map(e => e.tags.filter(e => e != "_untagged").map(e => x.has(e) ? x.get(e) : (x.set(e, i++), i))).filter(e => e.length);
						await navigator.clipboard.writeText(items.map(e => e.map(e => `#tag${e}`).join(", ")).join("\n"));
						new Notice("Copied to clipboard");
					})
			);
	}
}
