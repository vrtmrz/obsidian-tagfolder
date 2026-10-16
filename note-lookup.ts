export interface NoteLookupSource {
	readonly path: string;
	readonly title: string;
	readonly tags: readonly string[];
	readonly mtime: number;
}

export interface NoteLookupItem {
	readonly path: string;
	readonly title: string;
	readonly tags: readonly string[];
	readonly mtime: number;
}

export interface NoteLookupPolicy {
	readonly targetFolders: readonly string[];
	readonly ignoreFolders: readonly string[];
	readonly ignoreDocumentTags: readonly string[];
	readonly ignoreTags: readonly string[];
	readonly redirects: Readonly<Record<string, string>>;
	readonly splitNestedTags: boolean;
}

export interface LookupTagCondition {
	readonly tag: string;
	readonly excluded: boolean;
}

export interface TagCompletion extends LookupTagCondition {
	readonly noteCount: number;
}

export interface RankedNoteLookupItem extends NoteLookupItem {
	readonly matchCount: number;
	readonly matchedTags: readonly string[];
	readonly queryScore: number;
}

export interface RankNoteLookupOptions {
	readonly excludedPath?: string;
}

function normaliseTag(tag: string) {
	return tag.trim().replace(/^#/, "").replace(/\/+$/, "");
}

function uniqueCaseInsensitive(values: readonly string[]) {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		const key = value.toLowerCase();
		if (value == "" || seen.has(key)) continue;
		seen.add(key);
		result.push(value);
	}
	return result;
}

function folderMatches(path: string, folder: string) {
	const pathLower = path.toLowerCase();
	const folderLower = folder.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
	if (folderLower == "") return false;
	return pathLower == folderLower || pathLower.startsWith(`${folderLower}/`);
}

function normalisePolicyTags(tags: readonly string[]) {
	return new Set(tags.map(normaliseTag).filter(Boolean).map((tag) => tag.toLowerCase()));
}

export function normaliseLookupTags(rawTags: readonly string[], policy: NoteLookupPolicy) {
	const redirects = new Map(
		Object.entries(policy.redirects)
			.map(([tag, redirect]) => [normaliseTag(tag).toLowerCase(), normaliseTag(redirect)] as const)
			.filter(([tag, redirect]) => tag != "" && redirect != ""),
	);
	const redirected = rawTags
		.map(normaliseTag)
		.filter(Boolean)
		.map((tag) => redirects.get(tag.toLowerCase()) ?? tag);
	const expanded = policy.splitNestedTags
		? redirected.flatMap((tag) => tag.split("/").map((part) => part.trim()).filter(Boolean))
		: redirected;
	return uniqueCaseInsensitive(
		expanded.map((tag) => redirects.get(tag.toLowerCase()) ?? tag),
	);
}

export function buildNoteLookupItems(
	sources: readonly NoteLookupSource[],
	policy: NoteLookupPolicy,
): NoteLookupItem[] {
	const ignoredDocumentTags = normalisePolicyTags(policy.ignoreDocumentTags);
	const ignoredTags = normalisePolicyTags(policy.ignoreTags);

	return sources.flatMap((source) => {
		if (policy.targetFolders.length > 0
			&& !policy.targetFolders.some((folder) => folderMatches(source.path, folder))) {
			return [];
		}
		if (policy.ignoreFolders.some((folder) => folderMatches(source.path, folder))) {
			return [];
		}

		const tags = normaliseLookupTags(source.tags, policy);
		if (tags.some((tag) => ignoredDocumentTags.has(tag.toLowerCase()))) {
			return [];
		}

		return [{
			path: source.path,
			title: source.title,
			tags: tags.filter((tag) => !ignoredTags.has(tag.toLowerCase())),
			mtime: source.mtime,
		}];
	});
}

export function parseTagInput(input: string) {
	let query = input.trim();
	const excluded = query.startsWith("-");
	if (excluded) query = query.substring(1);
	query = query.replace(/^#/, "").trim();
	return { excluded, query };
}

export function tagMatchesCondition(noteTag: string, conditionTag: string) {
	const tag = normaliseTag(noteTag).toLowerCase();
	const condition = normaliseTag(conditionTag).toLowerCase();
	if (tag == "" || condition == "") return false;
	return tag == condition || tag.startsWith(`${condition}/`);
}

function tagAncestors(tag: string) {
	const parts = normaliseTag(tag).split("/").filter(Boolean);
	return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

export function getTagCompletions(
	items: readonly NoteLookupItem[],
	conditions: readonly LookupTagCondition[],
	input: string,
): TagCompletion[] {
	const { excluded, query } = parseTagInput(input);
	const queryLower = query.toLowerCase();
	const selected = new Set(conditions.map((condition) => normaliseTag(condition.tag).toLowerCase()));
	const counts = new Map<string, { tag: string; paths: Set<string> }>();

	for (const item of items) {
		for (const tag of uniqueCaseInsensitive(item.tags.flatMap(tagAncestors))) {
			const key = tag.toLowerCase();
			if (selected.has(key)) continue;
			const entry = counts.get(key) ?? { tag, paths: new Set<string>() };
			entry.paths.add(item.path);
			counts.set(key, entry);
		}
	}

	return [...counts.values()]
		.filter(({ tag }) => queryLower == "" || tag.toLowerCase().includes(queryLower))
		.sort((left, right) => {
			const leftPrefix = left.tag.toLowerCase().startsWith(queryLower) ? 1 : 0;
			const rightPrefix = right.tag.toLowerCase().startsWith(queryLower) ? 1 : 0;
			if (leftPrefix != rightPrefix) return rightPrefix - leftPrefix;
			if (left.paths.size != right.paths.size) return right.paths.size - left.paths.size;
			return left.tag.localeCompare(right.tag, undefined, { numeric: true, sensitivity: "base" });
		})
		.map(({ tag, paths }) => ({ tag, excluded, noteCount: paths.size }));
}

function scoreSubsequence(needle: string, haystack: string) {
	const exactIndex = haystack.indexOf(needle);
	if (exactIndex >= 0) {
		const prefixBonus = exactIndex == 0 ? 500 : 0;
		return 2_000 + prefixBonus - exactIndex - (haystack.length - needle.length) / 100;
	}

	let position = -1;
	let score = 0;
	for (const character of needle) {
		const next = haystack.indexOf(character, position + 1);
		if (next < 0) return null;
		const gap = next - position - 1;
		score += 20 - Math.min(gap, 19);
		if (next == 0 || "/-_ ".includes(haystack[next - 1] ?? "")) score += 10;
		position = next;
	}
	return score;
}

function scoreNoteQuery(item: NoteLookupItem, query: string) {
	const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
	if (words.length == 0) return 0;
	const title = item.title.toLowerCase();
	const path = item.path.toLowerCase();
	let total = 0;
	for (const word of words) {
		const titleScore = scoreSubsequence(word, title);
		const pathScore = scoreSubsequence(word, path);
		if (titleScore == null && pathScore == null) return null;
		total += Math.max(titleScore == null ? -Infinity : titleScore + 200, pathScore ?? -Infinity);
	}
	return total;
}

function uniqueConditions(conditions: readonly LookupTagCondition[]) {
	const seen = new Set<string>();
	return conditions.filter((condition) => {
		const tag = normaliseTag(condition.tag);
		const key = `${condition.excluded ? "-" : "+"}${tag.toLowerCase()}`;
		if (tag == "" || seen.has(key)) return false;
		seen.add(key);
		return true;
	}).map((condition) => ({ ...condition, tag: normaliseTag(condition.tag) }));
}

export function rankNoteLookupItems(
	items: readonly NoteLookupItem[],
	conditions: readonly LookupTagCondition[],
	noteQuery: string,
	options: RankNoteLookupOptions = {},
): RankedNoteLookupItem[] {
	const normalisedConditions = uniqueConditions(conditions);
	const positive = normalisedConditions.filter((condition) => !condition.excluded);
	const excluded = normalisedConditions.filter((condition) => condition.excluded);

	return items.flatMap((item) => {
		if (options.excludedPath != null && item.path == options.excludedPath) return [];
		if (excluded.some((condition) => item.tags.some((tag) => tagMatchesCondition(tag, condition.tag)))) {
			return [];
		}

		const matchedTags = positive
			.filter((condition) => item.tags.some((tag) => tagMatchesCondition(tag, condition.tag)))
			.map((condition) => condition.tag);
		if (positive.length > 0 && matchedTags.length == 0) return [];

		const queryScore = scoreNoteQuery(item, noteQuery);
		if (queryScore == null) return [];
		return [{ ...item, matchedTags, matchCount: matchedTags.length, queryScore }];
	}).sort((left, right) => {
		if (left.matchCount != right.matchCount) return right.matchCount - left.matchCount;
		if (left.queryScore != right.queryScore) return right.queryScore - left.queryScore;
		if (left.mtime != right.mtime) return right.mtime - left.mtime;
		return left.path.localeCompare(right.path, undefined, { numeric: true, sensitivity: "base" });
	});
}
