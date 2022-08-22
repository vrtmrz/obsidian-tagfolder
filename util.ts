import { SUBTREE_MARK, TreeItem, ViewItem, TagFolderItem } from "types";

export function unique<T>(items: T[]) {
	return [...new Set<T>([...items])];
}
export function allTags(entry: TagFolderItem): string[] {
	if ("tags" in entry) return entry.tags;
	return unique([...(entry?.descendants ?? []).flatMap(e => e.tags), ...entry.children.flatMap(e => "tag" in e ? allTags(e) : e.tags).filter(e => e)]);
}

export function isAutoExpandTree(entry: TreeItem) {
	if ("tag" in entry) {

		const childrenTags = entry.children.filter(
			(e) => "tag" in e
		) as TreeItem[];
		const childrenItems = (entry.allDescendants ?? entry.children).filter(
			(e) => "tags" in e
		) as ViewItem[];
		if (childrenTags.length == 0) return false;
		if (entry.itemsCount == 1) return true;
		if (childrenTags.length == 1 && childrenItems.length == 0) {
			// Only one tag and no children
			return true;
		}

		const entryAllTags = ancestorToTags(entry.ancestors.slice(1));

		const entryTags = ancestorToLongestTag(
			entryAllTags
		);

		//TODO: Too unintuitive.
		// just truncating tags till current position.
		// ex.) In `food`:
		// root/food/sweet/red -> sweet/red
		const childrenItemsTag = childrenItems.map(
			e => (
				{
					...e,
					tags: e.tags.map(
						oldTag => entryTags.reduce(
							(trimTag, tagToTrim) => (
								trimTag.startsWith(tagToTrim + "/") ?
									trimTag.substring(tagToTrim.length + 1)
									: trimTag)
							, oldTag)).filter(e => e)
				}));
		const firstLevelChildren = unique(
			[...childrenItemsTag.flatMap(e => e.tags.map(ee => ee.substring(0, (ee + "/").indexOf("/")))),
			...childrenTags.map(e => e.tag.startsWith(SUBTREE_MARK) ? e.tag.substring(SUBTREE_MARK.length) : e.tag)]).filter(e => !entryAllTags.contains(e));

		if (firstLevelChildren.length == 1) {
			return true;
		}

		if (childrenTags.length == 1 && childrenItems.length > 1) {
			// Check all children can be unified
			const sTags = allTags(entry).join("-").toLocaleLowerCase();
			for (const child of childrenItems) {
				const cTags = allTags(child).join("-").toLocaleLowerCase();
				if (sTags != cTags) {
					return false;
				}
			}
			return true;
		}
	}
	return false;
}

export function omittedTags(entry: TreeItem): false | string[] {
	const childrenTags = entry.children.filter(
		(e) => "tag" in e
	) as TreeItem[];
	const childrenItems = (entry.allDescendants ?? entry.children).filter(
		(e) => "tags" in e
	) as ViewItem[];

	// If children is already parsed, pass.
	if (childrenTags.length > 0) return false;
	// If child has been identified unique.
	const tx = childrenItems.map((e) => [...e.tags].sort().join("-"));
	if (tx.length != 1 && entry.itemsCount != 1) return false;
	// When any tags are left, add mark to title.
	const tags = unique(childrenItems.flatMap(e => e.tags));
	const ancestorTags = ancestorToTags(entry.ancestors).map(e => e.toLocaleLowerCase());
	const lastT = tags.filter((e) => !ancestorTags.contains(e.toLocaleLowerCase()));

	if (lastT.length) {
		return lastT;
	}
	return false;
}

export function ancestorToTags(ancestors: string[]): string[] {
	const SUBTREE_MARK_LENGTH = SUBTREE_MARK.length;
	return ancestors.reduce(
		(p, i) =>
			!i.startsWith(SUBTREE_MARK)
				? [...p, i]
				: [
					...p,
					p.pop() +
					"/" +
					i.substring(SUBTREE_MARK_LENGTH),
				],
		[]
	)
}
export function ancestorToLongestTag(ancestors: string[]): string[] {
	return ancestors.reduceRight((a: string[], e) => !a ? [e] : (a[0].startsWith(e) ? a : [e, ...a]), null)
}
