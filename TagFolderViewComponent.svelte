<script lang="ts">
	import { treeRoot } from "./store";
	import { TreeItem, ViewItem } from "./types";
	import TreeItemComponent from "./TreeItemComponent.svelte";

	export let items: Array<TreeItem | ViewItem> = [];
	export let openfile: (path: string) => void;
	export let vaultname: string = "";

	treeRoot.subscribe((root: TreeItem) => {
		items = root.children;
	});
</script>

<div class="wrapper">
	<div class="nav-folder mod-root">
		<div class="nav-folder-title">
			<div class="nav-folder-collapse-indicator collapse-icon" />
			<div class="nav-folder-title-content">Tags: {vaultname}</div>
		</div>
		<div class="nav-folder-children">
			{#each items as entry}
				<TreeItemComponent {entry} {openfile} />
			{/each}
		</div>
	</div>
</div>

<style>
	.wrapper {
		flex-grow: 1;
		padding-bottom: 20px;
	}
</style>
