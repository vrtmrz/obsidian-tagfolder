import { getLanguage, requireApiVersion } from "obsidian";
import { detectAppLanguage, setAppLanguage } from "./locale";

export function configureAppLocale(): void {
	setAppLanguage(detectAppLanguage({
		getLanguage: () => requireApiVersion("1.8.7") && typeof getLanguage === "function" ? getLanguage() : undefined,
	}));
}
