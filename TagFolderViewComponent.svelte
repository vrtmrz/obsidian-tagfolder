<script lang="ts">
	import { allViewItems, performHide, searchString, tagFolderSetting } from "./store";
	import { type ViewItem, type TagFolderSettings } from "./types";
	import V2TreeFolderComponent from "./V2TreeFolderComponent.svelte";
	import { onMount } from "svelte";
	import { setIcon } from "obsidian";
	import { trimTrailingSlash } from "./util";
	import { setContext } from "svelte";

	export let hoverPreview: (e: MouseEvent, path: string) => void;
	export let openFile: (path: string, specialKey: boolean) => void;
	export let vaultName: string = "";
	export let title: string = "";
	export let tags: string[] = [];

	export let showMenu: (
		evt: MouseEvent,
		trail: string[],
		targetTag?: string,
		targetItems?: ViewItem[]
	) => void;
	export let showLevelSelect: (evt: MouseEvent) => void;

	export let showOrder: (evt: MouseEvent) => void;

	export let newNote: (evt: MouseEvent) => void;

	export let openScrollView: (
		leaf: null,
		title: string,
		tagPath: string,
		files: string[]
	) => Promise<void>;

	export let isViewSwitchable: boolean;
	export let switchView: () => void;
	let isMainTree: boolean;

	let viewItemsSrc = [] as ViewItem[];
	allViewItems.subscribe((items) => {
		viewItemsSrc = items;
	});
	let search = "";

	$: {
		searchString.set(search);
	}
	searchString.subscribe((newSearch: string) => {
		if (search != newSearch) {
			if (newSearch != "") {
				showSearch = true;
			}
			search = newSearch;
		}
	});

	let _setting = $tagFolderSetting as TagFolderSettings;
	tagFolderSetting.subscribe((setting) => {
		_setting = setting;
	});
	let showSearch = false;
	function toggleSearch() {
		showSearch = !showSearch;
		if (!showSearch) {
			search = "";
		}
	}
	function clearSearch() {
		search = "";
	}

	function doSwitch() {
		if (switchView) {
			switchView();
		}
	}
	let iconDivEl: HTMLDivElement;
	let newNoteIcon = "";
	let folderIcon = "";
	let upAndDownArrowsIcon = "";
	let stackedLevels = "";
	let searchIcon = "";
	let switchIcon = "";

	onMount(async () => {
		setIcon(iconDivEl, "right-triangle");
		folderIcon = `${iconDivEl.innerHTML}`;
		setIcon(iconDivEl, "lucide-edit");
		newNoteIcon = `${iconDivEl.innerHTML}`;
		if (isMainTree) {
			setIcon(iconDivEl, "lucide-sort-asc");
			upAndDownArrowsIcon = iconDivEl.innerHTML;
			setIcon(iconDivEl, "stacked-levels");
			stackedLevels = iconDivEl.innerHTML;
			setIcon(iconDivEl, "search");
			searchIcon = iconDivEl.innerHTML;
		}
		setIcon(iconDivEl, "lucide-arrow-left-right");
		switchIcon = iconDivEl.innerHTML;
		const int = setInterval(()=>{
			performHide.set(Date.now());
		},5000);
		return ()=>{
			clearInterval(int);
		}
	});
	$: headerTitle = title == "" ? `Tags: ${vaultName}` : `Items: ${title}`;
	let viewItems = [] as ViewItem[];
	$: {
		if (viewItemsSrc) {
			if (isMainTree) {
				viewItems = viewItemsSrc;
			} else {
				let items = viewItemsSrc;
				const lowerTags = tags.map((e) => e.toLocaleLowerCase());
				for (const tag of lowerTags) {
					items = items.filter((e) =>
						e.tags.some((e) =>
							(e.toLocaleLowerCase() + "/").startsWith(tag)
						)
					);
				}

				const firstLevel = trimTrailingSlash(
					tags.first() ?? ""
				).toLocaleLowerCase();

				// Processing archive tags
				const archiveTags = _setting.archiveTags
					.toLocaleLowerCase()
					.replace(/[\n ]/g, "")
					.split(",");

				if (!archiveTags.contains(firstLevel)) {
					items = items.filter(
						(item) =>
							!item.tags.some((e) =>
								archiveTags.contains(e.toLocaleLowerCase())
							)
					);
				}
				viewItems = items;
			}
		}
	}
	$: isMainTree = tags.length == 0;
	let scrollParent: HTMLDivElement;
	setContext("tf-list", {
		getScrollParent: () => scrollParent,
	});
</script>

<div hidden bind:this={iconDivEl} />
<div class="nav-header">
	<div class="nav-buttons-container tagfolder-buttons-container">
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<div
			class="clickable-icon nav-action-button"
			aria-label="New note"
			on:click={newNote}
		>
			{@html newNoteIcon}
		</div>
		{#if isMainTree}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<div
				class="clickable-icon nav-action-button"
				aria-label="Change sort order"
				on:click={showOrder}
			>
				{@html upAndDownArrowsIcon}
			</div>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<div
				class="clickable-icon nav-action-button"
				aria-label="Expand limit"
				on:click={showLevelSelect}
			>
				{@html stackedLevels}
			</div>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<div
				class={"clickable-icon nav-action-button" +
					(showSearch ? " is-active" : "")}
				aria-label="Search"
				on:click={toggleSearch}
			>
				{@html searchIcon}
			</div>
		{/if}
		{#if isViewSwitchable}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<div
				class="clickable-icon nav-action-button"
				aria-label="Switch List/Tree"
				on:click={doSwitch}
			>
				{@html switchIcon}
			</div>
		{/if}
	</div>
</div>
{#if showSearch && isMainTree}
	<div class="search-input-container">
		<input
			type="search"
			spellcheck="false"
			placeholder="Type to start search..."
			bind:value={search}
		/>
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<div
			class="search-input-clear-button"
			aria-label="Clear search"
			style="display:{search.trim() == '' ? 'none' : ''};"
			on:click={clearSearch}
		/>
	</div>
{/if}
<div class="nav-files-container node-insert-event" bind:this={scrollParent}>
	<div class="tree-item nav-folder mod-root">
		<div class="tree-item-self nav-folder-title">
			<div class="tree-item-inner nav-folder-title-content">
				{headerTitle}
			</div>
		</div>
		<div class="tree-item-children nav-folder-children">
			<V2TreeFolderComponent
				items={viewItems}
				{folderIcon}
				thisName={""}
				isRoot={true}
				{showMenu}
				{openFile}
				{isMainTree}
				{hoverPreview}
				{openScrollView}
				depth={1}
			/>
		</div>
	</div>
</div>

<style>
	.nav-files-container {
		height: 100%;
	}
</style>
