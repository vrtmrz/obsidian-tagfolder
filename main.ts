/// <reference types="svelte" />

import {
	App,
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
	WorkspaceLeaf,
	TAbstractFile,
	type MarkdownFileInfo,
} from "obsidian";

import {
	DEFAULT_SETTINGS,
	OrderDirection,
	OrderKeyItem,
	OrderKeyTag,
	type ScrollViewFile,
	type ScrollViewState,
	type TagFolderListState,
	type TagFolderSettings,
	type TagInfoDict,
	VIEW_TYPE_SCROLL,
	VIEW_TYPE_TAGFOLDER,
	VIEW_TYPE_TAGFOLDER_LIST,
	type ViewItem,
	VIEW_TYPE_TAGFOLDER_LINK,
	type FileCache
} from "types";
import { allViewItems, allViewItemsByLink, appliedFiles, currentFile, maxDepth, searchString, selectedTags, tagFolderSetting, tagInfo } from "store";
import {
	compare,
	doEvents,
	fileCacheToCompare,
	parseAllReference,
	renderSpecialTag,
	secondsToFreshness,
	unique,
	updateItemsLinkMap,
	ancestorToLongestTag,
	ancestorToTags,
	joinPartialPath,
	removeIntermediatePath,
	trimTrailingSlash,
	isSpecialTag,
	trimPrefix
} from "./util";
import { ScrollView } from "./ScrollView";
import { TagFolderView } from "./TagFolderView";
import { TagFolderList } from "./TagFolderList";

export type DISPLAY_METHOD = "PATH/NAME" | "NAME" | "NAME : PATH";

// The `Intermidiate` is spelt incorrectly, but it is already used as the key of the configuration.
// Leave it to the future.
export type HIDE_ITEMS_TYPE = "NONE" | "DEDICATED_INTERMIDIATES" | "ALL_EXCEPT_BOTTOM";

const HideItemsType: Record<string, string> = {
	NONE: "Hide nothing",
	DEDICATED_INTERMIDIATES: "Only intermediates of nested tags",
	ALL_EXCEPT_BOTTOM: "All intermediates",
};


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dotted<T extends Record<string, any>>(object: T, notation: string) {
	return notation.split('.').reduce((a, b) => (a && (b in a)) ? a[b] : null, object);
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
function onElement<T extends HTMLElement | Document>(el: T, event: string, selector: string, callback: CallableFunction, options: EventListenerOptions) {
	//@ts-ignore
	el.on(event, selector, callback, options)
	//@ts-ignore
	return () => el.off(event, selector, callback, options);
}

export default class TagFolderPlugin extends Plugin {
	settings: TagFolderSettings = { ...DEFAULT_SETTINGS };

	// Folder opening status.
	expandedFolders: string[] = ["root"];

	// The File that now opening
	currentOpeningFile = "";

	searchString = "";

	allViewItems = [] as ViewItem[];
	allViewItemsByLink = [] as ViewItem[];

	compareItems: (a: ViewItem, b: ViewItem) => number = (_, __) => 0;

	getView(): TagFolderView | null {
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
	getLinkView(): TagFolderView | null {
		for (const leaf of this.app.workspace.getLeavesOfType(
			VIEW_TYPE_TAGFOLDER_LINK
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
				this.app.workspace.openLinkText(targetFile.path, targetFile.path, "tab");
			} else {
				// const leaf = this.app.workspace.getLeaf(false);
				// leaf.openFile(targetFile);
				this.app.workspace.openLinkText(targetFile.path, targetFile.path);
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

	getFileTitle(file: TFile): string {
		if (!this.settings.useTitle) return file.basename;
		const metadata = this.app.metadataCache.getCache(file.path);
		if (metadata?.frontmatter && (this.settings.frontmatterKey)) {
			const d = dotted(metadata.frontmatter, this.settings.frontmatterKey);
			if (d) return `${d}`;
		}
		if (metadata?.headings) {
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
			(leaf) => new TagFolderView(leaf, this, "tags")
		);
		this.registerView(
			VIEW_TYPE_TAGFOLDER_LINK,
			(leaf) => new TagFolderView(leaf, this, "links")
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
			this.loadFileInfo();
			if (this.settings.alwaysOpen) {
				await this.initView();
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
			id: "tagfolder-link-open",
			name: "Show Link Folder",
			callback: () => {
				this.activateViewLink();
			},
		});
		this.addCommand({
			id: "tagfolder-create-similar",
			name: "Create a new note with the same tags",
			editorCallback: async (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
				const file = view?.file;
				if (!file) return;
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache) return;
				const tags = getAllTags(cache) ?? [];
				const tagsWithoutPrefix = tags.map((e) => trimPrefix(e, "#"));
				await this.createNewNote(tagsWithoutPrefix);
			},
		});
		this.metadataCacheChanged = this.metadataCacheChanged.bind(this);
		this.watchWorkspaceOpen = this.watchWorkspaceOpen.bind(this);
		this.metadataCacheResolve = this.metadataCacheResolve.bind(this);
		this.metadataCacheResolved = this.metadataCacheResolved.bind(this);
		this.loadFileInfo = this.loadFileInfo.bind(this);
		this.registerEvent(
			this.app.metadataCache.on("changed", this.metadataCacheChanged)
		);
		this.registerEvent(
			this.app.metadataCache.on("resolve", this.metadataCacheResolve)
		);
		this.registerEvent(
			this.app.metadataCache.on("resolved", this.metadataCacheResolved)
		);

		this.refreshAllTree = this.refreshAllTree.bind(this);
		this.refreshTree = this.refreshTree.bind(this);
		this.registerEvent(this.app.vault.on("rename", this.refreshTree));
		this.registerEvent(this.app.vault.on("delete", this.refreshTree));
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
			this.refreshAllTree();
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
				let enumTags: Element | null = targetEl;
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

	watchWorkspaceOpen(file: TFile | null) {
		if (file) {
			this.currentOpeningFile = file.path;
		} else {
			this.currentOpeningFile = "";
		}
		currentFile.set(this.currentOpeningFile);
	}

	metadataCacheChanged(file: TFile) {
		this.loadFileInfoAsync(file);
	}
	metadataCacheResolve(file: TFile) {
		if (this.getLinkView() != null) {
			this.loadFileInfoAsync(file);
		}
	}
	metadataCacheResolved() {
		if (this.getLinkView() != null) {
			// console.warn("MetaCache Resolved")
			// this.loadFileInfo();
		}
	}

	refreshTree(file: TAbstractFile, oldName?: string) {
		if (file instanceof TFile) {
			this.loadFileInfo(file);
		}
	}

	refreshAllTree() {
		this.loadFileInfo();
	}

	fileCaches: FileCache[] = [];

	oldFileCache = "";


	parsedFileCache = new Map<string, number>();

	getFileCacheLinks(file: TFile) {
		const cachedLinks = this.app.metadataCache.resolvedLinks;
		const allLinks = this.getLinkView() == null ? [] : parseAllReference(cachedLinks, file.path, this.settings.linkConfig);

		const links = [...allLinks.filter(e => e.endsWith(".md")).map(e => `${e}`)];
		return links;
	}
	getFileCacheData(file: TFile): FileCache | false {
		const metadata = this.app.metadataCache.getFileCache(file);
		if (!metadata) return false;
		const links = this.getFileCacheLinks(file);
		return {
			file: file,
			links: links,
			tags: getAllTags(metadata) || [],
		};
	}
	updateFileCachesAll(): boolean {
		const filesAll = [...this.app.vault.getMarkdownFiles(), ...this.app.vault.getAllLoadedFiles().filter(e => "extension" in e && e.extension == "canvas") as TFile[]];
		const processFiles = filesAll.filter(file => this.parsedFileCache.get(file.path) ?? 0 != file.stat.mtime);
		const caches = processFiles.map(entry => this.getFileCacheData(entry)).filter(e => e !== false) as FileCache[];
		this.fileCaches = [...caches];
		return this.isFileCacheChanged();
	}
	isFileCacheChanged() {
		const fileCacheDump = JSON.stringify(
			this.fileCaches.map((e) => ({
				path: e.file.path,
				links: e.links,
				tags: e.tags,
			}))
		);
		if (this.oldFileCache == fileCacheDump) {
			return false;
		} else {
			this.oldFileCache = fileCacheDump;
			return true;
		}
	}


	updateFileCaches(diffs: (TFile | undefined)[] = []): boolean {
		let anyUpdated = false;

		if (this.fileCaches.length == 0 || diffs.length == 0) {
			return this.updateFileCachesAll();
		} else {
			const processDiffs = [...diffs];
			let newCaches = [...this.fileCaches];
			let diff = processDiffs.shift();
			do {
				const procDiff = diff;
				if (!procDiff) break;
				// Find old one and remove if exist once.
				const old = newCaches.find(
					(fileCache) => fileCache.file.path == procDiff.path
				);

				if (old) {
					newCaches = newCaches.filter(
						(fileCache) => fileCache !== old
					);
				}
				const newCache = this.getFileCacheData(procDiff);
				if (newCache) {
					// Update about references
					if (this.getLinkView() != null) {
						const oldLinks = old?.links || [];
						const newLinks = newCache.links;
						const all = unique([...oldLinks, ...newLinks]);
						// Updated or Deleted reference
						const diffs = all.filter(link => !oldLinks.contains(link) || !newLinks.contains(link))
						for (const filename of diffs) {
							const file = this.app.vault.getAbstractFileByPath(filename);
							if (file instanceof TFile) processDiffs.push(file);
						}
					}
					newCaches.push(newCache);
				}
				anyUpdated = anyUpdated || (JSON.stringify(fileCacheToCompare(old)) != JSON.stringify(fileCacheToCompare(newCache)));
				diff = processDiffs.shift();
			} while (diff !== undefined);
			this.fileCaches = newCaches;

		}
		return anyUpdated;
	}

	async getItemsList(mode: "tag" | "link"): Promise<ViewItem[]> {
		const items: ViewItem[] = [];
		const ignoreDocTags = this.settings.ignoreDocTags
			.toLowerCase()
			.replace(/[\n ]/g, "")
			.split(",");
		const ignoreTags = this.settings.ignoreTags
			.toLowerCase()
			.replace(/[\n ]/g, "")
			.split(",");

		const ignoreFolders = this.settings.ignoreFolders
			.toLowerCase()
			.replace(/\n/g, "")
			.split(",")
			.map((e) => e.trim())
			.filter((e) => !!e);
		const targetFolders = this.settings.targetFolders
			.toLowerCase()
			.replace(/\n/g, "")
			.split(",")
			.map((e) => e.trim())
			.filter((e) => !!e);


		const searchItems = this.searchString
			.toLowerCase()
			.split("|")
			.map((ee) => ee.split(" ").map((e) => e.trim()));


		const today = Date.now();
		const archiveTags = this.settings.archiveTags
			.toLowerCase()
			.replace(/[\n ]/g, "")
			.split(",");

		for (const fileCache of this.fileCaches) {
			if (
				targetFolders.length > 0 &&
				!targetFolders.some(
					(e) => {
						return e != "" &&
							fileCache.file.path.toLowerCase().startsWith(e)
					}
				)
			) {
				continue;
			}
			if (
				ignoreFolders.some(
					(e) =>
						e != "" &&
						fileCache.file.path.toLowerCase().startsWith(e)
				)
			) {
				continue;
			}
			await doEvents();
			const tagRedirectList = {} as { [key: string]: string };
			if (this.settings.useTagInfo && this.tagInfo) {
				for (const [key, taginfo] of Object.entries(this.tagInfo)) {
					if (taginfo?.redirect) {
						tagRedirectList[key] = taginfo.redirect;
					}
				}
			}

			let allTags = [] as string[];
			if (mode == "tag") {
				const allTagsDocs = unique(fileCache.tags);
				allTags = unique(allTagsDocs.map((e) => e.substring(1)).map(e => e in tagRedirectList ? tagRedirectList[e] : e));
			} else {
				allTags = unique(fileCache.links)
			}
			if (this.settings.disableNestedTags && mode == "tag") {
				allTags = allTags.map((e) => e.split("/")).flat();
			}
			if (allTags.length == 0) {
				if (mode == "tag") {
					allTags = ["_untagged"];
				} else if (mode == "link") {
					allTags = ["_unlinked"];
				}
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
					ignoreDocTags.contains(tag.toLowerCase())
				)
			) {
				continue;
			}

			// filter the items
			const w = searchItems.map((searchItem) => {
				let bx = false;
				if (allTags.length == 0) return false;
				for (const searchSrc of searchItem) {
					let search = searchSrc;
					let func = "contains" as "contains" | "startsWith";
					if (search.startsWith("#")) {
						search = search.substring(1);
						func = "startsWith";
					}
					if (search.startsWith("-")) {
						bx =
							bx ||
							allTags.some((tag) =>
								tag
									.toLowerCase()[func](search.substring(1))
							);
						// if (bx) continue;
					} else {
						bx =
							bx ||
							allTags.every(
								(tag) =>
									!tag.toLowerCase()[func](search)
							);
						// if (bx) continue;
					}
				}
				return bx;
			});

			if (w.every((e) => e)) continue;

			allTags = allTags.filter(
				(tag) => !ignoreTags.contains(tag.toLowerCase())
			);

			// if (this.settings.reduceNestedParent) {
			// 	allTags = mergeSameParents(allTags);
			// }

			const links = [...fileCache.links];
			if (links.length == 0) links.push("_unlinked");
			if (this.settings.disableNarrowingDown && mode == "tag") {
				const archiveTagsMatched = allTags.filter(e => archiveTags.contains(e.toLowerCase()));
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
						links: links,
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
					links: links,
				});
			}
		}
		return items;
	}

	lastSettings = "";
	lastSearchString = "";

	loadFileInfo(diff?: TFile) {
		this.loadFileInfoAsync(diff).then(e => {
			/* NO op*/
		});
	}

	processingFileInfo = false;
	isSettingChanged() {
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
		return isSearchStringModified || isSettingChanged;
	}
	loadFileQueue = [] as TFile[];
	loadFileTimer?: ReturnType<typeof setTimeout> = undefined;
	async loadFileInfos(diffs: TFile[]) {
		if (this.processingFileInfo) {
			diffs.forEach(e => this.loadFileInfoAsync(e));
			return;
		}
		try {
			this.processingFileInfo = true;
			const cacheUpdated = this.updateFileCaches(diffs);
			if (this.isSettingChanged() || cacheUpdated) {
				appliedFiles.set(diffs.map(e => e.path));
				await this.applyFileInfoToView();
			}
			// Apply content of diffs to each view.
			await this.applyUpdateIntoScroll(diffs);
		} finally {
			this.processingFileInfo = false;
		}
	}
	async applyFileInfoToView() {
		const items = await this.getItemsList("tag");
		const itemsSorted = items.sort(this.compareItems);
		this.allViewItems = itemsSorted;
		allViewItems.set(this.allViewItems);
		if (this.getLinkView() != null) {
			const itemsLink = await this.getItemsList("link");
			updateItemsLinkMap(itemsLink);
			const itemsLinkSorted = itemsLink.sort(this.compareItems);
			this.allViewItemsByLink = itemsLinkSorted;
			allViewItemsByLink.set(this.allViewItemsByLink);
		}
	}

	// Sweep updated file or all files to retrieve tags.
	async loadFileInfoAsync(diff?: TFile) {
		if (!diff) {
			this.loadFileQueue = [];
			if (this.loadFileTimer) {
				clearTimeout(this.loadFileTimer);
				this.loadFileTimer = undefined;
			}
			await this.loadFileInfos([]);
			return;
		}
		if (diff && this.loadFileQueue.some(e => e.path == diff?.path)) {
			//console.log(`LoadFileInfo already in queue:${diff?.path}`)
		} else {
			this.loadFileQueue.push(diff);
			//console.log(`LoadFileInfo queued:${diff.path}`);
		}
		if (this.loadFileTimer) {
			clearTimeout(this.loadFileTimer);
		}
		this.loadFileTimer = setTimeout(() => {
			if (this.loadFileQueue.length === 0) {
				// console.log(`No need to LoadFile`);
			} else {
				const diffs = [...this.loadFileQueue];
				this.loadFileQueue = [];
				this.loadFileInfos(diffs);
			}
		}, 200);
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

	async applyUpdateIntoScroll(files: TFile[]) {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SCROLL);
		for (const leaf of leaves) {
			const view = leaf.view as ScrollView;
			if (!view) continue;
			const viewState = leaf.getViewState();
			const scrollViewState = view?.getScrollViewState();
			if (!viewState || !scrollViewState) continue;
			const viewStat = { ...viewState, state: { ...scrollViewState } }
			for (const file of files) {
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
			}
			const tagPath = viewStat.state.tagPath;
			const tags = tagPath.split(", ");

			let matchedFiles = this.allViewItems;
			for (const tag of tags) {
				matchedFiles = matchedFiles.filter((item) =>
					item.tags
						.map((tag) => tag.toLowerCase())
						.some(
							(itemTag) =>
								itemTag ==
								tag.toLowerCase() ||
								(itemTag + "/").startsWith(
									tag.toLowerCase() +
									(tag.endsWith("/")
										? ""
										: "/")
								)
						)
				)
			}

			const newFilesArray = matchedFiles.map(e => e.path);
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

	async _initTagView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TAGFOLDER);
		if (leaves.length == 0) {
			await this.app.workspace.getLeftLeaf(false).setViewState({
				type: VIEW_TYPE_TAGFOLDER,
				state: { treeViewType: "tags" }
			});
		} else {
			const newState = leaves[0].getViewState();
			leaves[0].setViewState({
				type: VIEW_TYPE_TAGFOLDER,
				state: { ...newState, treeViewType: "tags" }
			})
		}
	}
	async _initLinkView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TAGFOLDER_LINK);
		if (leaves.length == 0) {
			await this.app.workspace.getLeftLeaf(false).setViewState({
				type: VIEW_TYPE_TAGFOLDER_LINK,
				state: { treeViewType: "links" }
			});
		} else {
			const newState = leaves[0].getViewState();
			leaves[0].setViewState({
				type: VIEW_TYPE_TAGFOLDER_LINK,
				state: { ...newState, treeViewType: "links" }
			})
		}
	}
	async initView() {
		this.loadFileInfo();
		await this._initTagView();
	}
	async initLinkView() {
		this.loadFileInfo();
		await this._initLinkView();
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
	async activateViewLink() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TAGFOLDER_LINK);
		await this.initLinkView();
		if (leaves.length > 0) {
			this.app.workspace.revealLeaf(
				leaves[0]
			);
		}

	}

	tagInfo: TagInfoDict = {};
	tagInfoFrontMatterBuffer: Record<string, object> = {};
	skipOnce = false;
	tagInfoBody = "";

	async modifyFile(file: TAbstractFile) {
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

	async refreshAllViewItems() {
		this.parsedFileCache.clear();
		const items = await this.getItemsList("tag");
		const itemsSorted = items.sort(this.compareItems);
		this.allViewItems = itemsSorted;
		allViewItems.set(this.allViewItems);

		const itemsLink = await this.getItemsList("link");
		const itemsLinkSorted = itemsLink.sort(this.compareItems);
		this.allViewItemsByLink = itemsLinkSorted;
		allViewItemsByLink.set(this.allViewItemsByLink);
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
		// this.compareTags = getCompareMethodTags(this.settings);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		await this.saveTagInfo();
		tagFolderSetting.set(this.settings);
		this.compareItems = getCompareMethodItems(this.settings);
		this.refreshAllViewItems();
		// this.compareTags = getCompareMethodTags(this.settings);
	}

	async openListView(tagSrc: string[]) {
		if (!tagSrc) return;
		const tags = tagSrc.first() == "root" ? tagSrc.slice(1) : tagSrc;

		let theLeaf: WorkspaceLeaf | undefined = undefined;
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
		// (theLeaf.view as TagFolderList).setTreeRoot(this.root);

		this.app.workspace.revealLeaf(
			theLeaf
		);
	}

	async createNewNote(tags?: string[]) {
		const expandedTagsAll = ancestorToLongestTag(ancestorToTags(joinPartialPath(removeIntermediatePath(tags ?? []))))
			.map((e) => trimTrailingSlash(e));

		const expandedTags = expandedTagsAll
			.map((e) => e
				.split("/")
				.filter((ee) => !isSpecialTag(ee))
				.join("/"))
			.filter((e) => e != "")
			.map((e) => "#" + e)
			.join(" ")
			.trim();

		//@ts-ignore
		const ww = await this.app.fileManager.createAndOpenMarkdownFile() as TFile;
		if (this.settings.useFrontmatterTagsForNewNotes) {
			await this.app.fileManager.processFrontMatter(ww, (matter) => {
				matter.tags = matter.tags ?? [];
				matter.tags = expandedTagsAll
					.filter(e => !isSpecialTag(e))
					.filter(e => matter.tags.indexOf(e) < 0)
					.concat(matter.tags);
			});
		}
		else {
			await this.app.vault.append(ww, expandedTags);
		}
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
					.onChange(async (value) => {
						this.plugin.settings.displayMethod = value as DISPLAY_METHOD;
						this.plugin.loadFileInfo();
						await this.plugin.saveSettings();
					})
			);
		const setOrderMethod = async (key?: string, order?: string) => {
			const oldSetting = this.plugin.settings.sortType.split("_");
			if (!key) key = oldSetting[0];
			if (!order) order = oldSetting[1];
			//@ts-ignore
			this.plugin.settings.sortType = `${key}_${order}`;
			await this.plugin.saveSettings();
			// this.plugin.setRoot(this.plugin.root);
		};
		new Setting(containerEl)
			.setName("Order method")
			.setDesc("how to order items")
			.addDropdown((dd) => {
				dd.addOptions(OrderKeyItem)
					.setValue(this.plugin.settings.sortType.split("_")[0])
					.onChange((key) => setOrderMethod(key, undefined));
			})
			.addDropdown((dd) => {
				dd.addOptions(OrderDirection)
					.setValue(this.plugin.settings.sortType.split("_")[1])
					.onChange((order) => setOrderMethod(undefined, order));
			});
		new Setting(containerEl)
			.setName("Prioritize items which are not contained in sub-folder")
			.setDesc("If this has been enabled, the items which have no more extra tags are first.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.sortExactFirst)
					.onChange(async (value) => {
						this.plugin.settings.sortExactFirst = value;
						await this.plugin.saveSettings();
					});
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

		const setOrderMethodTag = async (key?: string, order?: string) => {
			const oldSetting = this.plugin.settings.sortTypeTag.split("_");
			if (!key) key = oldSetting[0];
			if (!order) order = oldSetting[1];
			//@ts-ignore
			this.plugin.settings.sortTypeTag = `${key}_${order}`;
			await this.plugin.saveSettings();
			// this.plugin.setRoot(this.plugin.root);
		};
		new Setting(containerEl)
			.setName("Order method")
			.setDesc("how to order tags")
			.addDropdown((dd) => {
				dd.addOptions(OrderKeyTag)
					.setValue(this.plugin.settings.sortTypeTag.split("_")[0])
					.onChange((key) => setOrderMethodTag(key, undefined));
			})
			.addDropdown((dd) => {
				dd.addOptions(OrderDirection)
					.setValue(this.plugin.settings.sortTypeTag.split("_")[1])
					.onChange((order) => setOrderMethodTag(undefined, order));
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

		new Setting(containerEl)
			.setName("Store tags in frontmatter for new notes")
			.setDesc("Otherwise, tags are stored with #hashtags at the top of the note")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.useFrontmatterTagsForNewNotes)
					.onChange(async (value) => {
						this.plugin.settings.useFrontmatterTagsForNewNotes = value;
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

		containerEl.createEl("h3", { text: "Link Folder" });
		new Setting(containerEl)
			.setName("Use Incoming")
			.setDesc("")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.linkConfig.incoming.enabled)
					.onChange(async (value) => {
						this.plugin.settings.linkConfig.incoming.enabled = value;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Use Outgoing")
			.setDesc("")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.linkConfig.outgoing.enabled)
					.onChange(async (value) => {
						this.plugin.settings.linkConfig.outgoing.enabled = value;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Hide indirectly linked notes")
			.setDesc("")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.linkShowOnlyFDR)
					.onChange(async (value) => {
						this.plugin.settings.linkShowOnlyFDR = value;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Connect linked tree")
			.setDesc("")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.linkCombineOtherTree)
					.onChange(async (value) => {
						this.plugin.settings.linkCombineOtherTree = value;
						await this.plugin.saveSettings();
					})
			);

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
		new Setting(containerEl)
			.setName("Disable dragging tags")
			.setDesc("The `Dragging tags` is using internal APIs. If something happens, please disable this once and try again.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.disableDragging)
					.onChange(async (value) => {
						this.plugin.settings.disableDragging = value;
						await this.plugin.saveSettings();
					});
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
						const itemsAll = await this.plugin.getItemsList("tag");
						const items = itemsAll.map(e => e.tags.filter(e => e != "_untagged")).filter(e => e.length);
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
						const itemsAll = await this.plugin.getItemsList("tag");
						const items = itemsAll.map(e => e.tags.filter(e => e != "_untagged").map(e => x.has(e) ? x.get(e) : (x.set(e, i++), i))).filter(e => e.length);
						await navigator.clipboard.writeText(items.map(e => e.map(e => `#tag${e}`).join(", ")).join("\n"));
						new Notice("Copied to clipboard");
					})
			);
	}
}
