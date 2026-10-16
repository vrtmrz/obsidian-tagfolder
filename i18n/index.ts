// i18n 核心模块（T01 建立，API 签名为公共契约，不得单方面更改）
// 用法：
//   Svelte 组件内：  $t("英文原文", { 变量名: 值 })   —— 语言切换自动重渲染
//   命令式代码：     tr("英文原文", { 变量名: 值 })   —— 菜单/通知/设置页即时求值
//   切换语言：       applyLanguagePreference("auto" | "en" | "zh-CN")
// 铁律：key = 英文原文一字不差；词典缺 key 时回退英文原文（不报错）；
//       本文件禁止 import "obsidian"（保证 vitest 可直接导入）。
import { derived, get, writable } from "svelte/store";
import type { Readable, Writable } from "svelte/store";
import { getAppLanguage } from "../locale";
import mainDict from "./zh-CN/main";
import viewsDict from "./zh-CN/views";
import componentsDict from "./zh-CN/components";
import modalsDict from "./zh-CN/modals";
import typesDict from "./zh-CN/types";

export type LanguagePreference = "auto" | "en" | "zh-CN";
export type ResolvedLocale = "en" | "zh-CN";
export type Translator = (key: string, vars?: Record<string, string | number>) => string;

const dictionaries: Record<string, string> = {
	...mainDict,
	...viewsDict,
	...componentsDict,
	...modalsDict,
	...typesDict,
};

function localeToResolved(value: string): ResolvedLocale {
	const [language, ...subtags] = value.toLowerCase().split("-");
	if (language !== "zh") return "en";
	const script = subtags.find((part) => part.length === 4);
	if (script) return script === "hans" ? "zh-CN" : "en";
	return subtags.some((part) => ["tw", "hk", "mo"].includes(part)) ? "en" : "zh-CN";
}

/** Select a bundled translation without changing the application's collation language. */
export function detectObsidianLocale(): ResolvedLocale {
	return localeToResolved(getAppLanguage());
}

/**
 * 应用用户语言偏好（main.ts 的 loadSettings() 调用）：
 * Auto uses the configured application language; explicit choices affect only the UI.
 */
export function applyLanguagePreference(pref: LanguagePreference): void {
	resolvedLocale.set(pref === "auto" ? detectObsidianLocale() : pref);
}

/** Start in English until the plug-in loads the application language and settings. */
export const resolvedLocale: Writable<ResolvedLocale> = writable("en");

/** {name} 占位符插值：split/join 实现，不用正则。 */
function interpolate(template: string, vars?: Record<string, string | number>): string {
	if (!vars) return template;
	let result = template;
	for (const name of Object.keys(vars)) {
		result = result.split(`{${name}}`).join(String(vars[name]));
	}
	return result;
}

function translate(
	locale: ResolvedLocale,
	key: string,
	vars?: Record<string, string | number>
): string {
	const localized = locale === "zh-CN" ? dictionaries[key] : undefined;
	if (localized !== undefined) return interpolate(localized, vars);
	return interpolate(key, vars);
}

/** 响应式翻译器：Svelte 组件内用 $t("key")，随语言切换自动重渲染。 */
export const t: Readable<Translator> = derived(
	resolvedLocale,
	(locale) =>
		(key: string, vars?: Record<string, string | number>) =>
			translate(locale, key, vars)
);

/** 命令式翻译器：菜单/通知/设置页等非响应式场景用 tr("key")。 */
export function tr(key: string, vars?: Record<string, string | number>): string {
	return translate(get(resolvedLocale), key, vars);
}

/** 设置页「语言」下拉选项（固定三项，标签本身不参与翻译）。 */
export const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string }[] = [
	{ value: "auto", label: "Auto (follow Obsidian)" },
	{ value: "en", label: "English" },
	{ value: "zh-CN", label: "简体中文" },
];
