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
        const childrenItems = entry.children.filter(
            (e) => "tags" in e
        ) as ViewItem[];
        if (childrenTags.length == 1 && childrenItems.length == 0) {
            // Only one tag and no children
            return true;
        }
        // if (childrenItems.length > 0) {
        //     const tx = childrenItems.map((e) => [...e.tags].sort().join("-"));
        //     const ancestorTags = ancestorToTags(entry.ancestors);
        //     if (tx.length == 1) {
        //         // The children has unique tags.
        //         const tags = childrenItems[0].tags;
        //         const lastT = tags.filter((e) => !ancestorTags.contains(e));
        //         if (lastT.length == 0) return true;
        //     }
        // }
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
    const childrenItems = entry.children.filter(
        (e) => "tags" in e
    ) as ViewItem[];

    // If children is already parsed, pass.
    if (childrenTags.length > 0) return false;
    // If child has been identified unique.
    const tx = childrenItems.map((e) => [...e.tags].sort().join("-"));
    if (tx.length != 1) return false;
    // When any tags are left, add mark to title.
    const tags = childrenItems[0].tags;
    const ancestorTags = ancestorToTags(entry.ancestors).map(e => e.toLocaleLowerCase());
    const lastT = tags.filter((e) => !ancestorTags.contains(e.toLocaleLowerCase()));

    if (lastT.length) {
        return lastT;
    }
    return false;
}

export function ancestorToTags(ancestors: string[]) {
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