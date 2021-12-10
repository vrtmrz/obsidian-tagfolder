export interface ViewItem {
	tags: string[];
	path: string;
	displayName: string;
}

export interface TreeItem {
	tag: string;
	children: Array<TagFolderItem>;
}

export type TagFolderItem = TreeItem | ViewItem;
