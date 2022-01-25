export interface ViewItem {
	tags: string[];
	path: string;
	displayName: string;
	ancestors: string[];
	mtime: number;
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
