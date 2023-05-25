<script lang="ts">
	import { searchString, treeRoot } from "./store";
	import { TreeItem, TagFolderItem } from "./types";
	import TreeItemComponent from "./TreeItemComponent.svelte";
	import { onMount } from "svelte";
	import { setIcon } from "obsidian";
	import { pickEntry } from "./util";

	export let items: Array<TagFolderItem> = [];
	export let hoverPreview: (e: MouseEvent, path: string) => void;
	export let openfile: (path: string, specialKey: boolean) => void;
	export let expandFolder: (entry: TagFolderItem, expanded: boolean) => void;
	export let vaultname: string = "";
	export let title: string = "";
	export let tags: string[] = [];
	export let showMenu: (
		evt: MouseEvent,
		path: string,
		entry: TagFolderItem
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

	treeRoot.subscribe((root: TreeItem) => {
		if (tags.length == 0) {
			items = root?.children ?? [];
		} else {
			const pickedRoot = pickEntry(root, tags);
			if (pickedRoot && "tag" in pickedRoot) {
				items =
					pickedRoot.allDescendants ||
					pickedRoot.children.filter((e) => "tags" in e);
			} else {
				console.warn(`Could not pick root:${tags.join(", ")}`);
				console.warn(root);
				items = [];
			}
		}
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
	});
	$: headerTitle = title == "" ? `Tags: ${vaultname}` : `Items: ${title}`;
	$: isMainTree = tags.length == 0;
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
<div class="nav-files-container node-insert-event">
	<div class="tree-item nav-folder mod-root">
		<div class="tree-item-self nav-folder-title">
			<div class="tree-item-inner nav-folder-title-content">
				{headerTitle}
			</div>
		</div>
		<div class="tree-item-children nav-folder-children">
			{#each items as entry}
				<TreeItemComponent
					{entry}
					{hoverPreview}
					{openfile}
					{expandFolder}
					{showMenu}
					skippedTag={""}
					path="/"
					{openScrollView}
					{folderIcon}
					{isMainTree}
					parentTags={[
						...tags,
						"tag" in entry ? entry.tag : undefined,
					]}
				/>
			{/each}
		</div>
	</div>
</div>

<style>
	.nav-files-container {
		height: 100%;
	}
</style>
