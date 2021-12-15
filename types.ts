export interface ViewItem {
	tags: string[];
	path: string;
	displayName: string;
	ancestors: string[];
	mtime:number;
	filename:string;
}

export interface TreeItem {
	tag: string;
	children: Array<TagFolderItem>;
	ancestors: string[];
	descendants:Array<ViewItem>
}

export type TagFolderItem = TreeItem | ViewItem;
