
import type { TREE_TYPE, TagFolderSettings, TagInfoDict, ViewItem } from "./types";
import { V2FI_IDX_CHILDREN, type V2FolderItem, trimPrefix, parseTagName, pathMatch, getExtraTags, getViewItemFromPath, V2FI_IDX_TAG, V2FI_IDX_TAGNAME, V2FI_IDX_TAGDISP, waitForRequestAnimationFrame } from "./util";

export function performSortExactFirst(_items: ViewItem[], children: V2FolderItem[], leftOverItems: ViewItem[]) {

    // const m2 = measure("new");
    const childrenPathsArr = children.map((e) =>
        (e[V2FI_IDX_CHILDREN]).map((ee) => ee.path)).flat()

    const childrenPaths = new Set(
        childrenPathsArr
    );
    const exactHerePaths = new Set(_items.map((e) => e.path));
    childrenPaths.forEach((path) => exactHerePaths.delete(path));

    //const isHerePaths =

    const wk2 = [...leftOverItems].sort((a, b) => {
        const aIsInChildren = exactHerePaths.has(a.path);
        const bIsInChildren = exactHerePaths.has(b.path);
        return (aIsInChildren ? -1 : 0) + (bIsInChildren ? 1 : 0);
    });
    // m2();


    return [...wk2];
}
function delay() {
    return new Promise<void>(res => setTimeout(() => res(), 5));
}
function nextTick() {
    return new Promise<void>(res => setTimeout(() => res(), 0));
}
const delays = [nextTick, delay, nextTick, waitForRequestAnimationFrame];
let delayIdx = 0;
export async function collectChildren(previousTrail: string, tags: string[], _tagInfo: TagInfoDict, _items: ViewItem[]) {
    const previousTrailLC = previousTrail.toLowerCase();

    const children: V2FolderItem[] = [];
    const tagPerItem = new Map<string, ViewItem[]>();
    const lowercaseMap = new Map<string, string>();
    for (const item of _items) {
        const itemTags = item.tags;
        itemTags.forEach(itemTag => {
            const tagLc = lowercaseMap.get(itemTag) ?? lowercaseMap.set(itemTag, itemTag.toLowerCase()).get(itemTag)!;
            if (!tagPerItem.has(tagLc)) tagPerItem.set(tagLc, []);
            tagPerItem.get(tagLc)!.push(item);
        })
    }
    for (const tag of tags) {
        const tagLC = tag.toLowerCase();
        const tagNestedLC = trimPrefix(tagLC, previousTrailLC);
        const items: ViewItem[] = [];
        for (const [itemTag, tempItems] of tagPerItem) {
            if (pathMatch(itemTag, tagLC)) {
                items.push(...tempItems);
            } else if (pathMatch(itemTag, tagNestedLC)) {
                items.push(...tempItems);
            }
        }
        children.push(
            [
                tag,
                ...parseTagName(tag, _tagInfo),
                [...new Set(items)]
            ]
        )
        // Prevent UI freezing.
        delayIdx++; delayIdx %= 4;
        await (delays[delayIdx])();
    }
    return children;
}

export async function collectTreeChildren(
    { key,
        expandLimit, depth, tags, trailLower, _setting, isMainTree,
        isSuppressibleLevel, viewType, previousTrail, _tagInfo, _items, linkedItems, isRoot,
        sortFunc }
        :
        {
            key: string,
            expandLimit: number, depth: number, tags: string[], trailLower: string[], _setting: TagFolderSettings,
            isMainTree: boolean, isSuppressibleLevel: boolean, viewType: TREE_TYPE, previousTrail: string,
            _tagInfo: TagInfoDict, _items: ViewItem[], linkedItems: Map<string, ViewItem[]>, isRoot: boolean,
            sortFunc: (a: V2FolderItem, b: V2FolderItem) => number
        }
): Promise<{ suppressLevels: string[], children: V2FolderItem[] }> {
    let suppressLevels: string[] = []; // This will be shown as chip.
    let children: V2FolderItem[] = [];
    if (expandLimit && depth >= expandLimit) {
        // If expand limit had been configured and we have reached it,
        // suppress sub-folders and show that information as extraTags.
        children = [];
        suppressLevels = getExtraTags(
            tags,
            trailLower,
            _setting.reduceNestedParent
        );
    } else if (!isMainTree) {
        // If not in main tree, suppress sub-folders.
        children = [];
    } else if (isSuppressibleLevel) {
        // If we determined it was a suppressible,
        // suppress sub-folders and show that information as extraTags.
        children = [];
        suppressLevels = getExtraTags(
            tags,
            trailLower,
            _setting.reduceNestedParent
        );
    } else {
        let wChildren = [] as V2FolderItem[];
        if (viewType == "tags") {
            wChildren = await collectChildren(
                previousTrail,
                tags,
                _tagInfo,
                _items
            );
        } else if (viewType == "links") {
            // We made the list in the previous step.
            wChildren = tags.map((tag) => {
                const selfInfo = getViewItemFromPath(tag);
                const dispName = !selfInfo ? tag : selfInfo.displayName;
                const children = linkedItems.get(tag) ?? [];
                return [
                    tag,
                    dispName,
                    [dispName],
                    children,
                ] as V2FolderItem;
            });
        }
        if (viewType == "tags") {
            // -- Check redundant combination if configured.
            if (_setting.mergeRedundantCombination) {
                const out = [] as typeof wChildren;
                const isShown = new Set<string>();
                for (const [tag, tagName, tagsDisp, items] of wChildren) {
                    const list = [] as ViewItem[];
                    for (const v of items) {
                        if (!isShown.has(v.path)) {
                            list.push(v);
                            isShown.add(v.path);
                        }
                    }
                    if (list.length != 0)
                        out.push([tag, tagName, tagsDisp, list]);
                }
                wChildren = out;
            }

            // -- MainTree and Root specific structure modification.
            if (isMainTree && isRoot) {
                // Remove all items which have been already archived except is on the root.

                const archiveTags = _setting.archiveTags
                    .toLowerCase()
                    .replace(/[\n ]/g, "")
                    .split(",");
                wChildren = wChildren
                    .map((e) =>
                        archiveTags.some((aTag) =>
                            `${aTag}//`.startsWith(
                                e[V2FI_IDX_TAG].toLowerCase() + "/"
                            )
                        )
                            ? e
                            : ([
                                e[V2FI_IDX_TAG],
                                e[V2FI_IDX_TAGNAME],
                                e[V2FI_IDX_TAGDISP],
                                e[V2FI_IDX_CHILDREN].filter(
                                    (items) =>
                                        !items.tags.some((e) =>
                                            archiveTags.contains(
                                                e.toLowerCase()
                                            )
                                        )
                                ),
                            ] as V2FolderItem)
                    )
                    .filter(
                        (child) => child[V2FI_IDX_CHILDREN].length != 0
                    );
            }
        }
        wChildren = wChildren.sort(sortFunc);
        children = wChildren;
    }
    return { suppressLevels, children }
}