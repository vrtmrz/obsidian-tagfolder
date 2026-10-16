interface LanguageSources {
	getLanguage?: () => unknown;
}

let appLanguage = "en";
const comparators = new Map<string, (left: string, right: string) => number>();

function normaliseLanguage(value: unknown): string | undefined {
	if (typeof value !== "string" || value.trim() === "") return undefined;
	try {
		const language = value.trim().replace(/_/g, "-");
		return Intl.getCanonicalLocales(language.toLowerCase() === "kh" ? "km" : language)[0];
	} catch {
		return undefined;
	}
}

export function detectAppLanguage(sources: LanguageSources): string {
	try {
		return normaliseLanguage(sources.getLanguage?.()) ?? "en";
	} catch {
		return "en";
	}
}

export function setAppLanguage(language: string): void {
	appLanguage = normaliseLanguage(language) ?? "en";
	comparators.clear();
}

export function getAppLanguage(): string {
	return appLanguage;
}

export function createStringComparator(
	language = appLanguage,
	options: Intl.CollatorOptions = {},
): (left: string, right: string) => number {
	const locale = normaliseLanguage(language) ?? "en";
	const supported = Intl.Collator.supportedLocalesOf(locale)[0] ?? "en";
	const collator = new Intl.Collator(supported, { numeric: true, ...options });
	return (left, right) => collator.compare(left, right);
}

export function compareStrings(left: string, right: string, options: Intl.CollatorOptions = {}): number {
	const key = JSON.stringify(options);
	let compare = comparators.get(key);
	if (!compare) {
		compare = createStringComparator(appLanguage, options);
		comparators.set(key, compare);
	}
	return compare(left, right);
}
