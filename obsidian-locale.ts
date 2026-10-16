import { getLanguage, moment } from "obsidian";
import { detectAppLanguage, setAppLanguage } from "./locale";

export function configureAppLocale(): void {
	setAppLanguage(detectAppLanguage({
		getLanguage: typeof getLanguage === "function" ? getLanguage : undefined,
		getStoredLanguage: () => {
			// eslint-disable-next-line obsidianmd/prefer-get-language -- Compatibility with Obsidian versions before getLanguage() was added in 1.8.7.
			return window.localStorage.getItem("language");
		},
		getMomentLocale: () => moment.locale(),
	}));
}
