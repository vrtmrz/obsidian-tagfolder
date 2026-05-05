import type { TFile } from "obsidian";
import { type DISPLAY_METHOD, type HIDE_ITEMS_TYPE } from "./main";

export interface ViewItem {
	/**
	 * Historical reason, `tags` consists the list of either tag or link.
	 */
	tags: string[];
	extraTags: string[];
	path: string;
	displayName: string;
	ancestors: string[];
	mtime: number;
	ctime: number;
	filename: string;
	links: string[];
}
export interface TagInfoDict {
	[key: string]: TagInfo;
}
export interface TagInfo {
	key?: string;
	mark?: string;
	alt?: string;
	redirect?: string;
}


export type LinkParseConf = {
	outgoing: {
		enabled: boolean,
		key: string,
	},
	incoming: {
		enabled: boolean,
		key: string
	}
}
export const enumShowListIn = {
	"": "Sidebar",
	"CURRENT_PANE": "Current pane",
	"SPLIT_PANE": "New pane",
}

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
	sortExactFirst: boolean;
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
	useFrontmatterTagsForNewNotes: boolean,
	newNoteTemplate: string;
	doNotSimplifyTags: boolean;
	overrideTagClicking: boolean;
	useMultiPaneList: boolean;
	archiveTags: string;
	disableNarrowingDown: boolean;
	expandUntaggedToRoot: boolean;
	disableDragging: boolean;
	linkConfig: LinkParseConf;
	linkShowOnlyFDR: boolean;
	linkCombineOtherTree: boolean;
	showListIn: keyof typeof enumShowListIn;
	displayFolderAsTag: boolean;
}

export const DEFAULT_SETTINGS: TagFolderSettings = {
	displayMethod: "NAME",
	alwaysOpen: false,
	ignoreDocTags: "",
	ignoreTags: "",
	hideOnRootTags: "",
	sortType: "DISPNAME_ASC",
	sortExactFirst: false,
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
	useFrontmatterTagsForNewNotes: false,
	newNoteTemplate: "",
	doNotSimplifyTags: false,
	overrideTagClicking: false,
	useMultiPaneList: false,
	archiveTags: "",
	disableNarrowingDown: false,
	expandUntaggedToRoot: false,
	disableDragging: false,
	linkConfig: {
		incoming: {
			enabled: true,
			key: "",
		},
		outgoing: {
			enabled: true,
			key: ""
		}
	},
	linkShowOnlyFDR: true,
	linkCombineOtherTree: true,
	showListIn: "",
	displayFolderAsTag: false,
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
	_VIRTUAL_TAG_CANVAS: "📋 Canvas",
	_VIRTUAL_TAG_FOLDER: "📁"
};

export const VIEW_TYPE_TAGFOLDER = "tagfolder-view";
export const VIEW_TYPE_TAGFOLDER_LINK = "tagfolder-link-view";
export const VIEW_TYPE_TAGFOLDER_LIST = "tagfolder-view-list";
export type TREE_TYPE = "tags" | "links";

export const OrderKeyTag: Record<string, string> = {
	NAME: "Tag name",
	ITEMS: "Number of files",
};
export const OrderDirection: Record<string, string> = {
	ASC: "Ascending",
	DESC: "Descending",
};
export const OrderKeyItem: Record<string, string> = {
	DISPNAME: "File label",
	NAME: "File name",
	MTIME: "Modified time",
	CTIME: "Created time",
	FULLPATH: "Full file path",
};


export type TagFolderListState = {
	tags: string[];
	title: string;
}


export type FileCache = {
	file: TFile;
	links: string[];
	tags: string[];
}
