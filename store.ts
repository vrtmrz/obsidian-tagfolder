import { writable } from "svelte/store";
import { TreeItem } from "types";

export const treeRoot = writable<TreeItem>();
export const currentFile = writable<string>("");

export const maxDepth = writable<number>(0);
