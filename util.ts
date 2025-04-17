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
		[] as string[]
	)
}

export function ancestorToLongestTag(ancestors: string[]): string[] {
	return ancestors.reduceRight((a: string[], e) => !a ? [e] : (a[0]?.startsWith(e) ? a : [e, ...a]), []);
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
function delay(num?: number) {
	return new Promise<void>(res => setTimeout(() => res(), num || 5));
}
function nextTick() {
	return new Promise<void>(res => setTimeout(() => res(), 0));
}

// This is based on nothing.
const waits = [nextTick, delay, nextTick, delay, delay, nextTick];//[waitForRequestAnimationFrame, nextTick, nextTick, nextTick, waitForRequestAnimationFrame, delay, delay, nextTick];
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
		void pump();
	})
}


export function compare(x: string, y: string) {
	return `${x || ""}`.localeCompare(y, undefined, { numeric: true })
}


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
	return path.reduce((p, c) => (c.endsWith("/") && p.length > 0) ? [c + p[0], ...p.slice(1)] : [c, ...p], [] as string[]);
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
/*
let showResultTimer: ReturnType<typeof setTimeout>;
const measured = {} as Record<string, {
	count: number,
	spent: number,
}>;
const pf = window.performance;
export function measure(key: string) {
	const start = pf.now();
	return function end() {
		const end = pf.now();
		const spent = end - start;
		measured[key] = { count: (measured[key]?.count ?? 0) + 1, spent: (measured[key]?.spent ?? 0) + spent }
		if (showResultTimer) clearTimeout(showResultTimer);
		showResultTimer = setTimeout(() => {
			console.table(Object.fromEntries(Object.entries(measured).map(e => [e[0], { ...e[1], each: e[1].spent / e[1].count }])));
		}, 500)
	}
}
*/

export function isSameViewItems(a: ViewItem[][], b: ViewItem[][]) {
	if (a === b) return true;
	if (a.length != b.length) return false;
	for (const i in a) {
		if (a[i].length != b[i].length) {
			return false;
		}
		if (!_isSameViewItem(a[i], b[i])) return false;

	}
	return true;
}
export function _isSameViewItem(a: ViewItem[], b: ViewItem[]) {
	if (!a || !b) return false;
	if (a === b) return true;
	if (a.length != b.length) return false;
	for (const j in a) {
		if (a[j] === b[j]) return true;
		for (const k in a[j]) {
			if (!isSameObj(a[j][k as keyof ViewItem], b[j][k as keyof ViewItem])) return false;
		}
	}
	return true;
}
export function isSameV2FolderItem(a: V2FolderItem[][], b: V2FolderItem[][]) {
	if (a === b) return true;
	if (a.length != b.length) return false;
	for (const i in a) {
		if (a[i].length != b[i].length) {
			return false;
		}
		if (a[i] === b[i]) return true;
		for (const j in a[i]) {
			if (a[i][j][V2FI_IDX_TAG] !== b[i][j][V2FI_IDX_TAG]) return false;
			if (a[i][j][V2FI_IDX_TAGNAME] !== b[i][j][V2FI_IDX_TAGNAME]) return false;
			if (!isSameObj(a[i][j][V2FI_IDX_TAGDISP], b[i][j][V2FI_IDX_TAGDISP])) return false;
			if (!_isSameViewItem(a[i][j][V2FI_IDX_CHILDREN], b[i][j][V2FI_IDX_CHILDREN])) return false;
		}
	}
	return true;
}

export function isSameObj<T extends string | number | string[]>(a: T, b: typeof a) {
	if (a === b) return true;
	if (typeof a == "string" || typeof a == "number") {
		return a == b;
	}
	if (a.length != (b as string[]).length) return false;
	const len = a.length;
	for (let i = 0; i < len; i++) {
		if (!isSameObj(a[i], (b as string[])[i])) return false;
	}
	return true;
}

const waitingProcess = new Map<string, () => Promise<unknown>>();
const runningProcess = new Set<string>();



export async function scheduleOnceIfDuplicated<T>(key: string, proc: () => Promise<T>): Promise<void> {
	if (runningProcess.has(key)) {
		waitingProcess.set(key, proc);
		return;
	}
	try {
		runningProcess.add(key);
		await delay(3);
		if (waitingProcess.has(key)) {
			const nextProc = waitingProcess.get(key)!;
			waitingProcess.delete(key);
			runningProcess.delete(key);
			return scheduleOnceIfDuplicated(key, nextProc);
		} else {
			//console.log(`run!! ${key}`);
			await proc();
		}
	}
	finally {
		runningProcess.delete(key);
	}

}

export function isSameAny(a: unknown, b: unknown) {
	if (typeof a != typeof b) return false;
	switch (typeof a) {
		case "string":
		case "number":
		case "bigint":
		case "boolean":
		case "symbol":
		case "function":
		case "undefined":
			return a == b;
		case "object":
			if (a === b) return true;
			if (a instanceof Map || a instanceof Set) {
				if (a.size != (b as typeof a).size) return false;
				const v = [...a]
				const w = [...(b as typeof a)];
				for (let i = 0; i < v.length; i++) {
					if (v[i] != w[i]) return false;
				}
				return true;
			}
			if (Array.isArray(a)) {
				for (let i = 0; i < a.length; i++) {
					if (!isSameAny(a[i], (b as typeof a)[i])) return false;
				}
				return true;
			}
			{
				const x = Object.values(a!);
				const y = Object.values(b!);
				if (x.length != y.length) return false;
				for (let i = 0; i < x.length; i++) {
					if (!isSameAny(x[i], y[i])) return false;
				}
				return true;
			}
		default:
			return false;
	}

}
