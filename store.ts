import { writable } from "svelte/store";
import { TreeItem } from "types";

export const treeRoot = writable<TreeItem>();
