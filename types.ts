export interface ViewItem {
	tags: string[];
	path: string;
	displayName: string;
	ancestors: string[];
}

export interface TreeItem {
	tag: string;
	children: Array<TagFolderItem>;
	ancestors: string[];
}

export type TagFolderItem = TreeItem | ViewItem;
