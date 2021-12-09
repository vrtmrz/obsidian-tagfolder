<script lang="ts">
	import { TreeItem, ViewItem, TagFolderItem } from "./types";
	export let entry: TreeItem | ViewItem;
	export let openfile: (path: string) => void;
	let collapsed = true;

	function toggleFolder() {
		collapsed = !collapsed;
	}
	function getFilenames(entry: TreeItem) {
		let filenames: string[] = [];
		for (const item of entry.children) {
			if ("tag" in item) {
				filenames = [...filenames, ...getFilenames(item)];
			} else {
				filenames = [...filenames, item.entry.path];
			}
		}
		return Array.from(new Set([...filenames]));
	}
	function countUnique(entry: TreeItem) {
		return getFilenames(entry).length;
	}
	function openfileLocal(entry: TagFolderItem) {
		if ("entry" in entry) openfile(entry.entry.path);
	}
</script>

<div class="nav-folder  {collapsed ? 'is-collapsed' : ''}">
	{#if "tag" in entry}
		<div class="nav-folder-title" on:click={toggleFolder}>
			<div class="nav-folder-collapse-indicator collapse-icon">
				<svg
					viewBox="0 0 100 100"
					class="right-triangle"
					width="8"
					height="8"
					><path
						fill="currentColor"
						stroke="currentColor"
						d="M94.9,20.8c-1.4-2.5-4.1-4.1-7.1-4.1H12.2c-3,0-5.7,1.6-7.1,4.1c-1.3,2.4-1.2,5.2,0.2,7.6L43.1,88c1.5,2.3,4,3.7,6.9,3.7 s5.4-1.4,6.9-3.7l37.8-59.6C96.1,26,96.2,23.2,94.9,20.8L94.9,20.8z"
					/></svg
				>
			</div>
			<div class="nav-folder-title-content lsl-f">
				<div class="tagfolder-titletagname">
					{entry.tag}
				</div>
				<div class="tagfolder-quantity">{countUnique(entry)}</div>
			</div>
		</div>
		{#if entry.children && !collapsed}
			<div class="nav-folder-children">
				{#each entry.children as item}
					<svelte:self entry={item} {openfile} />
				{/each}
			</div>
		{/if}
	{:else if "entry" in entry}
		<div class="nav-folder-title" on:click={() => openfileLocal(entry)}>
			<div class="nav-folder-title-content">
				{entry.entry.path}
			</div>
		</div>
	{/if}
</div>

<style>
	.lsl-f {
		flex-direction: row;
		display: flex;
		flex-grow: 1;
	}
	.tagfolder-titletagname {
		flex-grow: 1;
	}
	.tagfolder-quantity {
		width: 3em;
		text-align: right;
	}
</style>
