<script lang="ts">
	import OnDemandRender from "OnDemandRender.svelte";

	import type { TagFolderSettings, ViewItem } from "types";
	import {
		renderSpecialTag,
		trimSlash,
		escapeStringToHTML,
		getExtraTags,
		uniqueCaseIntensive,
	} from "./util";
	import { currentFile, tagFolderSetting } from "./store";

	// Display props
	export let item: ViewItem;
	export let trail: string[];

	// Callbacks
	export let openFile: (path: string, specialKey: boolean) => void;
	export let showMenu: (
		evt: MouseEvent,
		trail: string[],
		targetTag?: string,
		targetItems?: ViewItem[]
	) => void;
	export let hoverPreview: (e: MouseEvent, path: string) => void;

	// Event handlers
	function handleMouseover(e: MouseEvent, path: string) {
		hoverPreview(e, path);
	}

	// Store subscribers
	let _currentActiveFilePath = "";
	let _setting = $tagFolderSetting as TagFolderSettings;
	currentFile.subscribe((path) => {
		_currentActiveFilePath = path;
	});

	tagFolderSetting.subscribe((setting) => {
		_setting = setting;
	});

	// To highlighting
	$: isActive = item.path == _currentActiveFilePath;

	// Compute extra tags.
	let extraTagsHtml = "";
	$: {
		const tagsLeft = uniqueCaseIntensive(
			getExtraTags(item.tags, [...trail], _setting.reduceNestedParent)
				.map((e) => trimSlash(e, false, true))
				.filter((e) => e != "")
		);
		// To improve the performance, prepare an HTML piece.
		extraTagsHtml = `<div class="tf-taglist">${tagsLeft
			.map(
				(e) => `<span>${escapeStringToHTML(renderSpecialTag(e))}</span>`
			)
			.join("")}</div>`;
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="tree-item nav-file">
	<OnDemandRender>
		<div
			class="tree-item-self is-clickable nav-file-title"
			class:is-active={isActive}
			on:click={(evt) => openFile(item.path, evt.metaKey || evt.ctrlKey)}
			on:mouseover={(e) => {
				handleMouseover(e, item.path);
			}}
			on:focus={() => {
				/* ignore aria complaint */
			}}
			on:contextmenu={(evt) => showMenu(evt, trail, undefined, [item])}
		>
			<div class="tree-item-inner nav-file-title-content lsl-f">
				{item.displayName}
			</div>
			{@html extraTagsHtml}
		</div>
		<div slot="placeholder">
			<div class="tree-item-self is-clickable nav-file-title">
				<div class="tree-item-inner nav-file-title-content lsl-f">
					...
				</div>
				<div class="tf-taglist">-</div>
			</div>
		</div>
	</OnDemandRender>
</div>
