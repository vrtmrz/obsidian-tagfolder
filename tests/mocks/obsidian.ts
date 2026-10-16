export class AbstractInputSuggest<T> {
	app: unknown;
	inputEl: HTMLInputElement;
	declare protected _type: T;

	constructor(app: unknown, inputEl: HTMLInputElement) {
		this.app = app;
		this.inputEl = inputEl;
	}

	setValue(value: string) {
		this.inputEl.value = value;
	}

	close() {}
}

export class App {}
export class Editor {}
export class ItemView {}
export class MarkdownView {}
export class Menu {}
export class Notice {
	constructor(_message: string) {}
}
export class Plugin {}
export class PluginSettingTab {}
export class Setting {}
export class SuggestModal<T> {
	app: unknown;
	declare protected _type: T;

	constructor(app: unknown) {
		this.app = app;
	}

	setPlaceholder(_placeholder: string) {}
	open() {}
}
export class TAbstractFile {}
export class TFile extends TAbstractFile {
	path = "";
	basename = "";
	extension = "md";
}
export class WorkspaceLeaf {}

export function debounce<T extends (...args: unknown[]) => unknown>(callback: T) {
	return callback;
}

export function getAllTags() {
	return [];
}

export function normalizePath(path: string) {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "");
}

export function parseYaml() {
	return {};
}

export const Platform = {};
