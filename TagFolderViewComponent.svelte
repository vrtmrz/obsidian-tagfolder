<script lang="ts">
	import { treeRoot } from "./store";
	import { TreeItem, TagFolderItem } from "./types";
	import TreeItemComponent from "./TreeItemComponent.svelte";

	export let items: Array<TagFolderItem> = [];
	export let openfile: (path: string) => void;
	export let expandFolder: (entry: TagFolderItem, expanded: boolean) => void;
	export let vaultname: string = "";
	export let showMenu: (
		evt: MouseEvent,
		path: string,
		entry: TagFolderItem
	) => void;

	export let showLevelSelect: (evt: MouseEvent) => void;

	export let showOrder: (evt: MouseEvent) => void;

	export let newNote: (evt: MouseEvent) => void;

	export let setSearchString: (search: string) => void;

	treeRoot.subscribe((root: TreeItem) => {
		items = root?.children ?? [];
	});

	let search = "";

	$: {
		// filterString.set(search);
		if (setSearchString != null) {
			setSearchString(search);
		}
	}
	let showSearch = false;
	function toggleSearch() {
		showSearch = !showSearch;
		if (!showSearch) {
			search = "";
		}
	}
</script>

<div class="nav-header">
	<div class="nav-buttons-container tagfolder-buttons-container">
		<div class="nav-action-button" aria-label="New note" on:click={newNote}>
			<svg viewBox="0 0 100 100" class="document" width="20" height="20"
				><path
					fill="currentColor"
					stroke="currentColor"
					d="M14,4v92h72V29.2l-0.6-0.6l-24-24L60.8,4L14,4z M18,8h40v24h24v60H18L18,8z M62,10.9L79.1,28H62V10.9z"
				/></svg
			>
		</div>
		<div
			class="nav-action-button"
			aria-label="Change sort order"
			on:click={showOrder}
		>
			<svg
				viewBox="0 0 100 100"
				class="up-and-down-arrows"
				width="20"
				height="20"
				><path
					fill="currentColor"
					stroke="currentColor"
					d="M25.8,5.9c-0.1,0-0.2,0-0.3,0.1c-0.1,0-0.1,0-0.2,0.1c-0.1,0-0.1,0-0.2,0.1c-0.1,0.1-0.3,0.2-0.4,0.3 c-0.1,0.1-0.2,0.1-0.3,0.2c-0.1,0.1-0.2,0.2-0.3,0.3L8.6,22.6c-0.8,0.8-0.8,2.1,0,2.9c0.8,0.8,2.1,0.8,2.9,0L24,12.9V76 c0,0.7,0.4,1.4,1,1.8c0.6,0.4,1.4,0.4,2,0c0.6-0.4,1-1,1-1.8V12.9l12.6,12.6c0.8,0.8,2.1,0.8,2.9,0c0.8-0.8,0.8-2.1,0-2.9 L27.7,6.9c-0.1-0.2-0.3-0.4-0.6-0.6c-0.2-0.2-0.5-0.3-0.8-0.3C26.2,6,26,5.9,25.8,5.9L25.8,5.9z M74,6c-1.1,0-2,0.9-2,2s0.9,2,2,2 s2-0.9,2-2S75.1,6,74,6z M74,14c-1.1,0-2,0.9-2,2s0.9,2,2,2s2-0.9,2-2S75.1,14,74,14z M73.8,21.9c-0.1,0-0.2,0-0.3,0.1 c-0.9,0.2-1.6,1-1.6,2v63.1L59.4,74.6c-0.5-0.5-1.2-0.7-1.9-0.6c-0.8,0.1-1.4,0.7-1.6,1.4c-0.2,0.7,0,1.5,0.6,2l15.8,15.7 c0,0.1,0.1,0.1,0.1,0.2l0.1,0.1c0,0,0.1,0.1,0.1,0.1c0,0,0,0,0.1,0c0.1,0.1,0.3,0.2,0.4,0.3c0,0,0,0,0.1,0c0,0,0.1,0,0.1,0.1 c0,0,0,0,0.1,0c0.1,0,0.1,0,0.2,0.1c0.2,0,0.4,0,0.6,0c0,0,0.1,0,0.1,0c0.2,0,0.3-0.1,0.5-0.2c0.3-0.1,0.5-0.3,0.7-0.6l15.9-15.8 c0.8-0.8,0.8-2.1,0-2.9c-0.8-0.8-2.1-0.8-2.9,0L76,87.1V24c0-0.6-0.2-1.1-0.6-1.5C75,22.1,74.4,21.9,73.8,21.9L73.8,21.9z M26,82 c-1.1,0-2,0.9-2,2c0,1.1,0.9,2,2,2c1.1,0,2-0.9,2-2C28,82.9,27.1,82,26,82z M26,90c-1.1,0-2,0.9-2,2s0.9,2,2,2c1.1,0,2-0.9,2-2 C28,90.9,27.1,90,26,90z"
				/></svg
			>
		</div>
		<div
			class="nav-action-button"
			aria-label="Expand limit"
			on:click={showLevelSelect}
		>
			<svg
				viewBox="0 0 100 100"
				class="stacked-levels"
				width="20"
				height="20"
				><path
					fill="currentColor"
					stroke="currentColor"
					d="M12,4c-1.1,0-2,0.9-2,2v20c0,1.1,0.9,2,2,2h14v21.7c0,0.2,0,0.4,0,0.7V84c0,1.1,0.9,2,2,2h26v8c0,1.1,0.9,2,2,2h32 c1.1,0,2-0.9,2-2V74c0-1.1-0.9-2-2-2H56c-1.1,0-2,0.9-2,2v8H30V52h24v8c0,1.1,0.9,2,2,2h32c1.1,0,2-0.9,2-2V40c0-1.1-0.9-2-2-2 H56c-1.1,0-2,0.9-2,2v8H30V28h14c1.1,0,2-0.9,2-2V6c0-1.1-0.9-2-2-2L12,4z M14,8h28v16H28.3c-0.1,0-0.2,0-0.3,0 c-0.1,0-0.2,0-0.3,0H14L14,8z M58,42h28v16H58v-7.7c0-0.2,0-0.4,0-0.7V42z M58,76h28v16H58v-7.7c0-0.2,0-0.4,0-0.7V76z"
				/></svg
			>
		</div>
		<div
			class="nav-action-button"
			aria-label="Search"
			on:click={toggleSearch}
		>
			<svg viewBox="0 0 100 100" class="search" width="20" height="20"
				><path
					fill="currentColor"
					stroke="currentColor"
					stroke-width="2"
					d="M42,6C23.2,6,8,21.2,8,40s15.2,34,34,34c7.4,0,14.3-2.4,19.9-6.4l26.3,26.3l5.6-5.6l-26-26.1c5.1-6,8.2-13.7,8.2-22.1 C76,21.2,60.8,6,42,6z M42,10c16.6,0,30,13.4,30,30S58.6,70,42,70S12,56.6,12,40S25.4,10,42,10z"
				/></svg
			>
		</div>
	</div>
</div>
<div class="nav-files-container">
	{#if showSearch}
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
				style="display: none;"
			/>
		</div>
	{/if}
	<div class="nav-folder mod-root">
		<div class="nav-folder-title">
			<div class="nav-folder-collapse-indicator collapse-icon" />
			<div class="nav-folder-title-content">Tags: {vaultname}</div>
		</div>
		<div class="nav-folder-children">
			{#each items as entry}
				<TreeItemComponent
					{entry}
					{openfile}
					{expandFolder}
					{showMenu}
					path="/"
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
