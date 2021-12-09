import { TFile } from "obsidian";

export interface ViewItem {
	tags: string[];
	entry: TFile;
}

export interface TreeItem {
	tag: string;
	children: Array<TagFolderItem>;
}

export type TagFolderItem = TreeItem | ViewItem;
