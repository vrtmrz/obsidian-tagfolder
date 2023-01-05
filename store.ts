import { writable } from "svelte/store";
import { DEFAULT_SETTINGS, TagFolderSettings, TagInfoDict, TreeItem } from "types";

export const treeRoot = writable<TreeItem>();
export const currentFile = writable<string>("");

export const maxDepth = writable<number>(0);

export const searchString = writable<string>("");
export const tagInfo = writable<TagInfoDict>({});

export const tagFolderSetting = writable<TagFolderSettings>(DEFAULT_SETTINGS);

export const selectedTags = writable<string[]>();