export interface ViewItem {
	tags: string[];
	path: string;
	displayName: string;
	ancestors: string[];
	mtime: number;
	ctime: number;
	filename: string;
}

export interface TreeItem {
	tag: string;
	children: Array<TagFolderItem>;
	ancestors: string[];
	descendants: Array<ViewItem>;
	isDedicatedTree: boolean;
	itemsCount: number;
	allDescendants: Array<ViewItem>;
	descendantsMemo?: Array<ViewItem>;
}

export type TagFolderItem = TreeItem | ViewItem;

export const SUBTREE_MARK = "→ ";
export const SUBTREE_MARK_REGEX = /\/→ /g;

export interface TagInfoDict {
	[key: string]: TagInfo;
}
export interface TagInfo {
	key: string;
	mark?: string;
}

import { DISPLAY_METHOD, HIDE_ITEMS_TYPE } from "./main";

export interface TagFolderSettings {
	displayMethod: DISPLAY_METHOD;
	alwaysOpen: boolean;
	ignoreDocTags: string;
	ignoreTags: string;
	ignoreFolders: string;
	targetFolders: string;
	hideOnRootTags: string;
	sortType: "DISPNAME_ASC" |
	"DISPNAME_DESC" |
	"NAME_ASC" |
	"NAME_DESC" |
	"MTIME_ASC" |
	"MTIME_DESC" |
	"CTIME_ASC" |
	"CTIME_DESC" |
	"FULLPATH_ASC" |
	"FULLPATH_DESC";
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
	useVirtualTag: boolean;
	doNotSimplifyTags: boolean;
	overrideTagClicking: boolean;
	useMultiPaneList: boolean;
}

export const DEFAULT_SETTINGS: TagFolderSettings = {
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
	targetFolders: "",
	scanDelay: 250,
	useTitle: true,
	reduceNestedParent: true,
	frontmatterKey: "title",
	useTagInfo: false,
	tagInfo: "pininfo.md",
	mergeRedundantCombination: false,
	useVirtualTag: false,
	doNotSimplifyTags: false,
	overrideTagClicking: false,
	useMultiPaneList: false,
};

export const VIEW_TYPE_SCROLL = "tagfolder-view-scroll";

export type ScrollViewFile = {
	path: string;
	title?: string;
	content?: string;
	renderedHTML?: string;
}
export type ScrollViewState = {
	files: ScrollViewFile[],
	title: string,
	tagPath: string,
}

export const EPOCH_MINUTE = 60;
export const EPOCH_HOUR = EPOCH_MINUTE * 60;
export const EPOCH_DAY = EPOCH_HOUR * 24;

export const FRESHNESS_1 = "FRESHNESS_01";
export const FRESHNESS_2 = "FRESHNESS_02";
export const FRESHNESS_3 = "FRESHNESS_03";
export const FRESHNESS_4 = "FRESHNESS_04";
export const FRESHNESS_5 = "FRESHNESS_05";


export const tagDispDict: { [key: string]: string } = {
	FRESHNESS_01: "🕐",
	FRESHNESS_02: "📖",
	FRESHNESS_03: "📗",
	FRESHNESS_04: "📚",
	FRESHNESS_05: "🗄",
	_VIRTUAL_TAG_FRESHNESS: "⌛",
	_VIRTUAL_TAG_CANVAS: "📋 Canvas"
};

export const CONTEXT_KEY = Symbol();
export type TagFolderViewContext = {
	isMainTree: boolean;
}