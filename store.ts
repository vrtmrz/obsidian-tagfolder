import { writable } from "svelte/store";
import { TagInfoDict, TreeItem } from "types";

export const treeRoot = writable<TreeItem>();
export const currentFile = writable<string>("");

export const maxDepth = writable<number>(0);

export const filterString = writable<string>("");
export const tagInfo = writable<TagInfoDict>({});

