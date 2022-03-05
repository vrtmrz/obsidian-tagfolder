<script lang="ts">
	import { currentFile, maxDepth } from "store";
	import {
		TreeItem,
		TagFolderItem,
		SUBTREE_MARK_REGEX,
		SUBTREE_MARK,
	} from "./types";
	export let entry: TagFolderItem;
	export let openfile: (path: string) => void;
	export let expandFolder: (entry: TagFolderItem, expanded: boolean) => void;
	export let showMenu: (
		evt: MouseEvent,
		path: string,
		entry: TagFolderItem
	) => void;
	export let path: string;
	let collapsed = true;
	let isSelected = false;
	const currentPath = path + ("tag" in entry ? entry.tag + "/" : "");
	const currentDepth = path
		.replace(SUBTREE_MARK_REGEX, "###")
		.split("/").length;
	let _maxDepth = 0;

	function toggleFolder(entry: TagFolderItem) {
		if ("tag" in entry) {
			expandFolder(entry, collapsed);
			collapsed = !collapsed;
		}
	}
	function getFilenames(entry: TreeItem) {
		if (entry.allDescendants == null) {
			return [];
		} else {
			const filenames = entry.allDescendants.map((e) => e.path);
			return Array.from(new Set([...filenames]));
		}
	}

	function openfileLocal(entry: TagFolderItem) {
		if ("path" in entry) openfile(entry.path);
	}
	function handleContextMenu(
		e: MouseEvent,
		path: string,
		entry: TagFolderItem
	) {
		showMenu(e, path, entry);
	}

	currentFile.subscribe((path: string) => {
		isSelected = false;
		if ("tags" in entry && entry.path == path) {
			isSelected = true;
		}
		if ("tag" in entry && getFilenames(entry).contains(path)) {
			isSelected = true;
		}
	});
	maxDepth.subscribe((depth: number) => {
		_maxDepth = depth;
		if (depth == 0) {
			_maxDepth = currentDepth + 1;
		}
	});
</script>

<slot>
	{#if "tag" in entry && (currentDepth <= _maxDepth || entry.tag.startsWith(SUBTREE_MARK))}
		<div class="nav-folder" class:is-collapsed={collapsed}>
			<div
				class="nav-folder-title"
				class:is-active={entry.children && collapsed && isSelected}
				on:click={() => toggleFolder(entry)}
				on:contextmenu={(e) => handleContextMenu(e, currentPath, entry)}
			>
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
					<div class="tagfolder-quantity">{entry.itemsCount}</div>
				</div>
			</div>
			{#if entry.children && !collapsed}
				<div class="nav-folder-children">
					{#each entry.children.filter((e) => "tag" in e) as item}
						<svelte:self
							entry={item}
							{openfile}
							{expandFolder}
							{showMenu}
							path={currentPath}
						/>
					{/each}
				</div>
			{/if}
			{#if _maxDepth != 1 && currentDepth > _maxDepth}
				{#if entry.allDescendants && !collapsed}
					<div class="nav-folder-children">
						{#each entry.allDescendants as item}
							<svelte:self
								entry={item}
								{openfile}
								{expandFolder}
								{showMenu}
								path={currentPath}
							/>
						{/each}
					</div>
				{/if}
			{:else if entry.descendants && !collapsed}
				<div class="nav-folder-children">
					{#each entry.descendants as item}
						<svelte:self
							entry={item}
							{openfile}
							{expandFolder}
							{showMenu}
							path={currentPath}
						/>
					{/each}
				</div>
			{/if}
		</div>
	{:else if "path" in entry}
		<div class="nav-file">
			<div
				class="nav-file-title"
				class:is-active={isSelected}
				on:click={() => openfileLocal(entry)}
				on:contextmenu={(e) => handleContextMenu(e, currentPath, entry)}
			>
				<div class="nav-file-title-content">
					{entry.displayName}
				</div>
			</div>
		</div>
	{/if}
</slot>

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
