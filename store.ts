import { writable } from "svelte/store";
import { DEFAULT_SETTINGS, type TagFolderSettings, type TagInfoDict, type ViewItem } from "types";
import type TagFolderPlugin from "./main";

export const currentFile = writable<string>("");

export const maxDepth = writable<number>(0);

export const searchString = writable<string>("");
export const tagInfo = writable<TagInfoDict>({});

export const tagFolderSetting = writable<TagFolderSettings>(DEFAULT_SETTINGS);

export const selectedTags = writable<string[]>();

//v2 
export const allViewItems = writable<ViewItem[]>();
export const allViewItemsByLink = writable<ViewItem[]>();
export const appliedFiles = writable<string[]>();
export const v2expandedTags = writable(new Set<string>());

export const performHide = writable(0);

export const pluginInstance = writable<TagFolderPlugin>(undefined);
