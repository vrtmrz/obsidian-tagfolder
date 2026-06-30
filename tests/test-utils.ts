import type { ViewItem } from "../types";

export function viewItem(path: string, tags: string[]): ViewItem {
	return {
		tags,
		extraTags: [],
		path,
		displayName: path.split("/").pop()?.replace(/\.md$/, "") ?? path,
		ancestors: [],
		mtime: 0,
		ctime: 0,
		filename: path.split("/").pop() ?? path,
		links: [],
	};
}
