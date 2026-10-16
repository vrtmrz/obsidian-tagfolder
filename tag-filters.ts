export type TagFilterPattern = {
	pattern: string;
	regExp?: RegExp;
};

function normalizeTagFilterValue(value: string) {
	return value.trim().toLowerCase().replace(/^#/, "").replace(/^\/|\/$/g, "");
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseTagFilterPatterns(value: string): TagFilterPattern[] {
	return value
		.replace(/[\n ]/g, "")
		.split(",")
		.map(normalizeTagFilterValue)
		.filter((pattern) => pattern != "")
		.map((pattern) => ({
			pattern,
			regExp: pattern.includes("*")
				? new RegExp(`^${pattern.split("*").map(escapeRegExp).join(".*")}$`, "u")
				: undefined,
		}));
}

export function tagMatchesFilterPatterns(tag: string, patterns: readonly TagFilterPattern[]) {
	const normalizedTag = normalizeTagFilterValue(tag);
	return patterns.some((filter) =>
		filter.regExp ? filter.regExp.test(normalizedTag) : filter.pattern == normalizedTag
	);
}

export function isVisibleInArchiveBranch(tags: readonly string[], branch: string, patterns: readonly TagFilterPattern[]) {
	const normalizedBranch = normalizeTagFilterValue(branch);
	let archived = false;
	for (const tag of tags) {
		if (!tagMatchesFilterPatterns(tag, patterns)) continue;
		archived = true;
		const normalizedTag = normalizeTagFilterValue(tag);
		if (normalizedBranch != "" && (
			normalizedTag == normalizedBranch || normalizedTag.startsWith(`${normalizedBranch}/`)
		)) return true;
	}
	return !archived;
}
