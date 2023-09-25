import { allViewItemsByLink, tagInfo } from "store";
import {
	EPOCH_DAY,
	EPOCH_HOUR,
	FRESHNESS_1,
	FRESHNESS_2,
	FRESHNESS_3,
	FRESHNESS_4,
	FRESHNESS_5,
	tagDispDict,
	type TagFolderSettings,
	type TagInfo,
	type TagInfoDict,
	type ViewItem,
	type LinkParseConf,
	type FileCache
} from "types";

export function unique<T>(items: T[]) {
	return [...new Set<T>([...items])];
}

export function trimSlash(src: string, keepStart = false, keepEnd = false) {
	const st = keepStart ? 0 : (src[0] == "/" ? 1 : 0);
	const end = keepEnd ? undefined : (src.endsWith("/") ? -1 : undefined);
	if (st == 0 && end == undefined) return src;
	return src.slice(st, end);
}
export function trimPrefix(source: string, prefix: string) {
	if (source.startsWith(prefix)) {
		return source.substring(prefix.length);
	}
	return source;
}

export function ancestorToTags(ancestors: string[]): string[] {
	return [...ancestors].reduce(
		(p, i) =>
			i[0] != "/"
				? [...p, i]
				: [
					...p,
					p.pop() +
					"/" +
					i.substring(1),
				],
		[]
	)
}

export function ancestorToLongestTag(ancestors: string[]): string[] {
	return ancestors.reduceRight((a: string[], e) => !a ? [e] : (a[0]?.startsWith(e) ? a : [e, ...a]), [])
}

export function isSpecialTag(tagSrc: string) {
	const tag = trimSlash(tagSrc);
	return tag == "_untagged" || tag in tagDispDict;
}

let tagDispAlternativeDict: { [key: string]: string } = {};
tagInfo.subscribe(tagInfo => {
	tagDispAlternativeDict = { ...tagDispDict };
	if (tagInfo == null) {
		return;
	}
	const items = Object.entries(tagInfo);
	for (const [key, info] of items) {
		if (info?.alt) {
			tagDispAlternativeDict[key] = info.alt;
		}
	}
});

export function renderSpecialTag(tagSrc: string) {
	const tag = trimSlash(tagSrc);
	return tag in tagDispAlternativeDict ? tagDispAlternativeDict[tag] : tagSrc;
}

export function secondsToFreshness(totalAsMSec: number) {
	const totalAsSec = ~~(totalAsMSec / 1000);
	const sign = totalAsSec / Math.abs(totalAsSec);
	const totalSec = ~~(totalAsSec * sign);
	if (totalSec < EPOCH_HOUR) return FRESHNESS_1
	if (totalSec < EPOCH_HOUR * 6) return FRESHNESS_2
	if (totalSec < EPOCH_DAY * 3) return FRESHNESS_3
	if (totalSec < EPOCH_DAY * 7) return FRESHNESS_4
	return FRESHNESS_5
}

const queues = [] as (() => void)[];

export function waitForRequestAnimationFrame() {
	return new Promise<void>(res => requestAnimationFrame(() => res()));
}
function delay() {
	return new Promise<void>(res => setTimeout(() => res(), 5));
}

// This is based on nothing.
const waits = [waitForRequestAnimationFrame, waitForRequestAnimationFrame, delay];
let waitIdx = 0;
let pumping = false;
let startContinuousProcessing = Date.now();

async function pump() {
	if (pumping) return;
	try {
		pumping = true;
		do {
			const proc = queues.shift();
			if (proc) {
				proc();
				const now = Date.now();
				if (now - startContinuousProcessing > 120) {
					const w = waits[waitIdx];
					waitIdx = (waitIdx + 1) % waits.length;
					await w();
					startContinuousProcessing = Date.now();
				}
			} else {
				break;
			}
			// eslint-disable-next-line no-constant-condition
		} while (true);
	} finally {
		pumping = false;
	}


}

// The message pump having ancient name.
export const doEvents = () => {

	return new Promise<void>(res => {
		const proc = () => {
			res();
		};
		queues.push(proc);
		pump();
	})
}


export const compare = (Intl && Intl.Collator) ? (new Intl.Collator().compare) :
	(x: string, y: string) => (`${x ?? ""}`).localeCompare(`${y ?? ""}`);


export function getTagName(tagName: string, subtreePrefix: string, tagInfo: TagInfoDict | undefined, invert: number) {
	if (tagInfo == undefined) return tagName;
	const prefix = invert == -1 ? `\uffff` : `\u0001`;
	const unpinned = invert == 1 ? `\uffff` : `\u0001`;

	if (tagName in tagInfo && tagInfo[tagName]) {
		if ("key" in tagInfo[tagName]) {
			return `${prefix}_${subtreePrefix}_-${tagInfo[tagName].key}__${tagName}`;
		}
	}
	return `${prefix}_${subtreePrefix}_${unpinned}_${tagName}`
}

function lc(str: string) {
	return str.toLowerCase();
}

/**
 * returns paths without intermediate paths.
 * i.e.) "test", "test/a" and "test/b/c" should be "test/a" and "test/b/c";
 *       However, "test", "test/a", "test/b/c", "test", should be "test/a", "test/b/c", "test"
 * @param paths array of path
 */
export function removeIntermediatePath(paths: string[]) {
	const passed = [] as string[];
	for (const v of paths) {
		const last = passed.pop();
		if (last !== undefined) {
			if (!(trimTrailingSlash(v.toLowerCase()) + "/").startsWith(trimTrailingSlash(last.toLowerCase()) + "/")) {
				// back to the stack
				passed.push(last);
			}
		}
		passed.push(v);
	}
	return passed.reverse();
}

export function removeIntermediatePathOld(paths: string[]) {
	const out = [...paths];
	const pathEntries = paths.sort((a, b) => a.length - b.length);
	const removeList = [] as string[];
	for (const el of pathEntries) {
		const elLower = lc(el);
		const elCapped = elLower.endsWith("/") ? elLower : (elLower + "/");
		if (out.some(e => lc(e).startsWith(elCapped) && lc(e) !== elCapped)) {
			removeList.push(el);
		}
	}
	return out.filter(e => removeList.indexOf(e) == -1)
}

export function getTagMark(tagInfo: TagInfo | undefined) {
	if (!tagInfo) return "";
	if ("key" in tagInfo) {
		if ("mark" in tagInfo && tagInfo.mark != "") {
			return tagInfo.mark;
		} else {
			return "📌";
		}
	} else {
		if ("mark" in tagInfo && tagInfo.mark != "") {
			return tagInfo.mark;
		} else {
			return "";
		}
	}
}

export function escapeStringToHTML(str: string) {
	if (!str) return "";
	return str.replace(/[<>&"'`]/g, (match) => {
		const escape: Record<string, string> = {
			"<": "&lt;",
			">": "&gt;",
			"&": "&amp;",
			'"': "&quot;",
			"'": "&#39;",
			"`": "&#x60;",
		};
		return escape[match];
	});
}

export type V2FolderItem = [tag: string, tagName: string, tagNameDisp: string[], children: ViewItem[]];
export const V2FI_IDX_TAG = 0;
export const V2FI_IDX_TAGNAME = 1;
export const V2FI_IDX_TAGDISP = 2;
export const V2FI_IDX_CHILDREN = 3;


/**
 * Select compare methods for tags from configurations and tag information.
 * @param settings 
 * @param tagInfo 
 * @returns 
 */
export function selectCompareMethodTags(settings: TagFolderSettings, tagInfo: TagInfoDict) {
	const _tagInfo = tagInfo;
	const invert = settings.sortTypeTag.contains("_DESC") ? -1 : 1;
	const subTreeChar: Record<typeof invert, string> = {
		[-1]: `\u{10ffff}`,
		[1]: `_`
	}
		;
	const sortByName = (a: V2FolderItem, b: V2FolderItem) => {
		const isASubTree = a[V2FI_IDX_TAGDISP][0] == "";
		const isBSubTree = b[V2FI_IDX_TAGDISP][0] == "";
		const aName = a[V2FI_IDX_TAGNAME];
		const bName = b[V2FI_IDX_TAGNAME];
		const aPrefix = isASubTree ? subTreeChar[invert] : "";
		const bPrefix = isBSubTree ? subTreeChar[invert] : "";
		return compare(getTagName(aName, aPrefix, settings.useTagInfo ? _tagInfo : undefined, invert), getTagName(bName, bPrefix, settings.useTagInfo ? _tagInfo : undefined, invert)) * invert;
	}
	switch (settings.sortTypeTag) {
		case "ITEMS_ASC":
		case "ITEMS_DESC":
			return (a: V2FolderItem, b: V2FolderItem) => {
				const aName = a[V2FI_IDX_TAGNAME];
				const bName = b[V2FI_IDX_TAGNAME];
				const aCount = a[V2FI_IDX_CHILDREN].length - ((settings.useTagInfo && (aName in _tagInfo && "key" in _tagInfo[aName])) ? 100000 * invert : 0);
				const bCount = b[V2FI_IDX_CHILDREN].length - ((settings.useTagInfo && (bName in _tagInfo && "key" in _tagInfo[bName])) ? 100000 * invert : 0);
				if (aCount == bCount) return sortByName(a, b);
				return (aCount - bCount) * invert;
			}
		case "NAME_ASC":
		case "NAME_DESC":
			return sortByName
		default:
			console.warn("Compare method (tags) corrupted");
			return (a: V2FolderItem, b: V2FolderItem) => {
				const isASubTree = a[V2FI_IDX_TAGDISP][0] == "";
				const isBSubTree = b[V2FI_IDX_TAGDISP][0] == "";
				const aName = a[V2FI_IDX_TAGNAME];
				const bName = b[V2FI_IDX_TAGNAME];
				const aPrefix = isASubTree ? subTreeChar[invert] : "";
				const bPrefix = isBSubTree ? subTreeChar[invert] : "";
				return compare(aPrefix + aName, bPrefix + bName) * invert;
			}
	}
}

/**
 * Extracts unique set in case insensitive.
 * @param pieces 
 * @returns 
 */
export function uniqueCaseIntensive(pieces: string[]): string[] {
	const delMap = new Set<string>();
	const ret = [];
	for (const piece of pieces) {
		if (!delMap.has(piece.toLowerCase())) {
			ret.push(piece);
			delMap.add(piece.toLowerCase());
		}
	}
	return ret;
}

export function _sorterTagLength(a: string, b: string, invert: boolean) {
	const lenA = a.split("/").length;
	const lenB = b.split("/").length;
	const diff = lenA - lenB;
	if (diff != 0) return diff * (invert ? -1 : 1);
	return (a.length - b.length) * (invert ? -1 : 1);
}

export function getExtraTags(tags: string[], trail: string[], reduceNestedParent: boolean) {
	let tagsLeft = uniqueCaseIntensive(tags);
	let removeTrailItems = [] as string[];

	if (reduceNestedParent) {
		removeTrailItems = trail.sort((a, b) => _sorterTagLength(a, b, true));
	} else {
		removeTrailItems = removeIntermediatePath(trail);
	}

	for (const t of removeTrailItems) {
		const inDedicatedTree = t.endsWith("/");
		const trimLength = inDedicatedTree ? t.length : t.length;
		// If reduceNestedParent is enabled, we have to remove prefix of all tags.
		// Note: if the nested parent has been reduced, the prefix will be appeared only once in the trail.
		// In that case, if `test/a`, `test/b` exist and expanded as test -> a -> b, trails should be `test/` `test/a` `test/b`
		if (reduceNestedParent) {
			tagsLeft = tagsLeft.map((e) =>
				(e + "/").toLowerCase().startsWith(t.toLowerCase())
					? e.substring(trimLength)
					: e
			);
		} else {
			// Otherwise, we have to remove the prefix only of the first one.
			// test -> a test -> b, trails should be `test/` `test/a` `test/` `test/b`
			const f = tagsLeft.findIndex((e) =>
				(e + "/")
					.toLowerCase()
					.startsWith(t.toLowerCase())
			);
			if (f !== -1) {
				tagsLeft[f] = tagsLeft[f].substring(trimLength);
			}
		}
	}
	return tagsLeft.filter((e) => e.trim() != "");
}


export function trimTrailingSlash(src: string) {
	return trimSlash(src, true, false);
}

export function joinPartialPath(path: string[]) {
	return path.reduceRight((p, c) => (c.endsWith("/") && p.length > 0) ? [c + p[0], ...p.slice(1)] : [c, ...p], [] as string[]);
}

export function pathMatch(haystackLC: string, needleLC: string) {
	if (haystackLC == needleLC) return true;
	if (needleLC[needleLC.length - 1] == "/") {
		if ((haystackLC + "/").indexOf(needleLC) === 0) return true;
	}
	return false;
}

export function parseTagName(thisName: string, _tagInfo: TagInfoDict): [string, string[]] {
	let tagNameDisp = [""];
	const names = thisName.split("/").filter((e) => e.trim() != "");
	let inSubTree = false;
	let tagName = "";
	if (names.length > 1) {
		tagName = `${names[names.length - 1]}`;
		inSubTree = true;
	} else {
		tagName = thisName;
	}
	if (tagName.endsWith("/")) {
		tagName = tagName.substring(0, tagName.length - 1);
	}
	const tagInfo = tagName in _tagInfo ? _tagInfo[tagName] : undefined;
	const tagMark = getTagMark(tagInfo);
	tagNameDisp = [`${tagMark}${renderSpecialTag(tagName)}`];
	if (inSubTree)
		tagNameDisp = [`${tagMark}`, `${renderSpecialTag(tagName)}`];

	return [tagName, tagNameDisp]
}

function parseAllForwardReference(metaCache: Record<string, Record<string, number>>, filename: string, passed: string[]) {

	const allForwardLinks = Object.keys(metaCache?.[filename] ?? {}).filter(e => !passed.contains(e));
	const ret = unique(allForwardLinks);
	return ret;
}
function parseAllReverseReference(metaCache: Record<string, Record<string, number>>, filename: string, passed: string[]) {
	const allReverseLinks = Object.entries((metaCache)).filter(([, links]) => filename in links).map(([name,]) => name).filter(e => !passed.contains(e));
	const ret = unique(allReverseLinks);
	return ret;
}

export function parseAllReference(metaCache: Record<string, Record<string, number>>, filename: string, conf: LinkParseConf): string[] {
	const allForwardLinks = (!conf?.outgoing?.enabled) ? [] : parseAllForwardReference(metaCache, filename, []);
	const allReverseLinks = (!conf?.incoming?.enabled) ? [] : parseAllReverseReference(metaCache, filename, []);
	let linked = [...allForwardLinks, ...allReverseLinks];
	if (linked.length != 0) linked = unique([filename, ...linked]);

	return linked;
}

export function isIntersect<T>(a: T[], b: T[]) {
	if (a.length == 0 && b.length != 0) return false;
	if (a.length != 0 && b.length == 0) return false;
	const allKeys = [...unique(a), ...unique(b)];
	const dedupeKey = unique(allKeys);
	return allKeys.length != dedupeKey.length;
}

export function isValid<T>(obj: T | false): obj is T {
	return obj !== false;
}

export function fileCacheToCompare(cache: FileCache | undefined | false) {
	if (!cache) return "";
	return ({ l: cache.links, t: cache.tags })
}

const allViewItemsMap = new Map<string, ViewItem>();
allViewItemsByLink.subscribe(e => {
	updateItemsLinkMap(e);
});
export function updateItemsLinkMap(e: ViewItem[]) {
	allViewItemsMap.clear();
	if (e) e.forEach(item => allViewItemsMap.set(item.path, item));
}

export function getViewItemFromPath(path: string) {
	return allViewItemsMap.get(path);
}

export function getAllLinksRecursive(item: ViewItem, trail: string[]): string[] {
	const allLinks = item.links;
	const leftLinks = allLinks.filter(e => !trail.contains(e));
	const allChildLinks = leftLinks.flatMap(itemName => {
		const item = getViewItemFromPath(itemName);
		if (!item) return [];
		return getAllLinksRecursive(item, [...trail, itemName]);
	})
	return unique([...leftLinks, ...allChildLinks]);
}
