<script lang="ts">
	import { searchString, treeRoot } from "./store";
	import { TreeItem, TagFolderItem } from "./types";
	import TreeItemComponent from "./TreeItemComponent.svelte";
	import { onMount } from "svelte";
	import { setIcon } from "obsidian";
	import { ancestorToLongestTag, ancestorToTags, pickEntry } from "./util";

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
	let iconDivEl: HTMLDivElement;
	let documentIcon = "";
	let folderIcon = "";
	let upAndDownArrowsIcon = "";
	let stackedLevels = "";
	let searchIcon = "";

	onMount(async () => {
		setIcon(iconDivEl, "right-triangle", 24);
		folderIcon = `${iconDivEl.innerHTML}`;
		setIcon(iconDivEl, "document", 20);
		documentIcon = `${iconDivEl.innerHTML}`;
		if (isMainTree) {
			setIcon(iconDivEl, "lucide-sort-asc", 20);
			upAndDownArrowsIcon = iconDivEl.innerHTML;
			setIcon(iconDivEl, "stacked-levels", 20);
			stackedLevels = iconDivEl.innerHTML;
			setIcon(iconDivEl, "search", 20);
			searchIcon = iconDivEl.innerHTML;
		}
	});
	$: headerTitle = title == "" ? `Tags: ${vaultname}` : `Items: ${title}`;
	$: isMainTree = tags.length == 0;
</script>

<div hidden bind:this={iconDivEl} />
<div class="nav-header">
	<div class="nav-buttons-container tagfolder-buttons-container">
		<div
			class="clickable-icon nav-action-button"
			aria-label="New note"
			on:click={newNote}
		>
			{@html documentIcon}
		</div>
		{#if isMainTree}
			<div
				class="clickable-icon nav-action-button"
				aria-label="Change sort order"
				on:click={showOrder}
			>
				{@html upAndDownArrowsIcon}
			</div>
			<div
				class="clickable-icon nav-action-button"
				aria-label="Expand limit"
				on:click={showLevelSelect}
			>
				{@html stackedLevels}
			</div>
			<div
				class="clickable-icon nav-action-button"
				aria-label="Search"
				on:click={toggleSearch}
			>
				{@html searchIcon}
			</div>
		{/if}
	</div>
</div>
<div class="nav-files-container">
	{#if showSearch && isMainTree}
		<div class="search-input-container">
			<input
				type="text"
				spellcheck="false"
				placeholder="Type to start search..."
				bind:value={search}
			/>
			<div
				class="search-input-clear-button"
				aria-label="Clear search"
				style="display:{search.trim() == '' ? 'none' : ''};"
				on:click={clearSearch}
			/>
		</div>
	{/if}
	<div class="nav-folder mod-root">
		<div class="nav-folder-title">
			<div class="nav-folder-collapse-indicator collapse-icon" />
			<div class="nav-folder-title-content">{headerTitle}</div>
		</div>
		<div class="nav-folder-children">
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
	.nav-folder {
		padding-bottom: 64px;
	}
	.nav-files-container {
		height: 100%;
	}
</style>
