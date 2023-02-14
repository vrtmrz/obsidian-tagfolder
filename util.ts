import { tagInfo } from "store";
import {
	EPOCH_DAY,
	EPOCH_HOUR,
	FRESHNESS_1,
	FRESHNESS_2,
	FRESHNESS_3,
	FRESHNESS_4,
	FRESHNESS_5,
	SUBTREE_MARK,
	tagDispDict,
	TagFolderItem,
	TagFolderSettings,
	TreeItem,
	ViewItem
} from "types";

export function unique<T>(items: T[]) {
	return [...new Set<T>([...items])];
}

export function allTags(entry: TagFolderItem): string[] {
	if ("tags" in entry) return entry.tags;
	return unique([...(entry?.descendants ?? []).flatMap(e => e.tags), ...entry.children.flatMap(e => "tag" in e ? allTags(e) : e.tags).filter(e => e)]);
}

export function isAutoExpandTree(entry: TreeItem, setting: TagFolderSettings) {
	if (setting.doNotSimplifyTags) return false;
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

export function omittedTags(entry: TreeItem, setting: TagFolderSettings): false | string[] {
	if (setting.doNotSimplifyTags) return false;
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


export function isSpecialTag(tagSrc: string) {
	const tag = tagSrc.startsWith(SUBTREE_MARK)
		? tagSrc.substring(SUBTREE_MARK.length)
		: tagSrc;
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
		if ("alt" in info) {
			tagDispAlternativeDict[key] = info.alt;
		}
	}
});

export function renderSpecialTag(tagSrc: string) {
	const tag = tagSrc.startsWith(SUBTREE_MARK)
		? tagSrc.substring(SUBTREE_MARK.length)
		: tagSrc;
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

function waitForRequestAnimationFrame() {
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
				if (now - startContinuousProcessing > 22) {
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


//TODO:TIDY
export function pickEntry(entry: TagFolderItem, path: string | string[], past: string[] = []): TagFolderItem | null {
	const paths = typeof path == "string" ? path.split("/").slice(1) : path;
	const [head, ...tail] = paths;

	if (!entry) return null;
	if (!head) return entry;

	if (!("children" in entry)) {
		if (past.contains(head)) {
			return pickEntry(entry, tail, [...past, head.toLocaleLowerCase()]);
		} else {
			console.log("Picked leaf is not leaf")
			return null;
		}
	}
	const next = entry.children.find(e => "tag" in e && compare(e.tag, head) == 0);
	if (!next) {
		if (past.contains(head)) {
			return pickEntry(entry, tail, [...past, head.toLocaleLowerCase()]);
		} else {
			console.log("Picking leaf looks something wrong")
			return null;
		}
	}
	return pickEntry(next, tail, [...past, head.toLocaleLowerCase()]);
}