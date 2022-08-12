<script lang="ts">
	import { currentFile, maxDepth, tagInfo } from "./store";
	import {
		TreeItem,
		TagFolderItem,
		SUBTREE_MARK_REGEX,
		SUBTREE_MARK,
		ViewItem,
	} from "./types";
	import type { TagInfoDict } from "./types";
	export let entry: TagFolderItem;
	export let hoverPreview: (e: MouseEvent, path: string) => void;
	export let openfile: (path: string) => void;
	export let expandFolder: (entry: TagFolderItem, expanded: boolean) => void;
	export let showMenu: (
		evt: MouseEvent,
		path: string,
		entry: TagFolderItem
	) => void;
	export let path: string;
	export let skippedTag: string;

	let collapsed = true;
	let isSelected = false;

	function getItemPath(item: TagFolderItem, basepath?: string) {
		if (item && "tag" in item) {
			return basepath + item.tag + "/";
		}
		return basepath;
	}
	$: currentPath = getItemPath(entry, path);
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
	function contextMenuFunc(entry: TagFolderItem) {
		const _path = currentPath;
		const _entry = entry;
		return (e: MouseEvent) => {
			handleContextMenu(e, _path, _entry);
		};
	}

	function handleMouseover(e: MouseEvent, entry: TagFolderItem) {
		if (entry && "path" in entry) hoverPreview(e, entry.path);
	}

	currentFile.subscribe((path: string) => {
		isSelected = false;
		if ("tags" in entry && entry.path == path) {
			isSelected = true;
		}
		if ("tag" in entry && getFilenames(entry).indexOf(path) !== -1) {
			isSelected = true;
		}
	});
	let _tagInfo: TagInfoDict = {};
	maxDepth.subscribe((depth: number) => {
		_maxDepth = depth;
		if (depth == 0) {
			_maxDepth = currentDepth + 1;
		}
	});
	tagInfo.subscribe((info: TagInfoDict) => {
		_tagInfo = info;
	});
	$: curTaginfo =
		"tag" in entry && entry.tag in _tagInfo ? _tagInfo[entry.tag] : null;
	$: tagMark = !curTaginfo
		? ""
		: "mark" in curTaginfo && curTaginfo.mark
		? curTaginfo.mark
		: "📌";

	let tagTitle = "";

	let showOnlyChildren = false;
	$: {
		showOnlyChildren = false;
		const getChildren = (entry: TreeItem): string[] =>
			entry.children
				.map((e) => ("tag" in e ? getChildren(e) : e.tags))
				.flat();

		if ("tag" in entry) {
			const childrenTags = entry.children.filter(
				(e) => "tag" in e
			) as TreeItem[];
			const childrenItems = entry.children.filter(
				(e) => "tags" in e
			) as ViewItem[];
			if (childrenTags.length == 1 && childrenItems.length == 0) {
				// Only one tag and no children
				showOnlyChildren = true;
			}
			if (entry.itemsCount == 1) {
				if (childrenTags.length == 1) {
					showOnlyChildren = true;
					// memo
					// const k = cx.ancestors.reduce(
					// 	(p, i) =>
					// 		!i.startsWith(SUBTREE_MARK)
					// 			? [...p, i]
					// 			: [
					// 					...p,
					// 					p.pop() +
					// 						"/" +
					// 						i.substring(SUBTREE_MARK.length),
					// 			  ],
					// 	[]
					// );
				}
			}
		}
	}
	$: tagTitle =
		"tag" in entry
			? `${
					skippedTag
						? `${skippedTag}${
								entry.tag.startsWith(SUBTREE_MARK) ? " " : "/"
						  }`
						: ""
			  }${tagMark}${entry.tag}`
			: "";
	let children: TagFolderItem[] = [];
	$: {
		let cx: TagFolderItem[] = [];
		if ("tag" in entry) {
			if (showOnlyChildren) {
				cx = [...cx, ...entry.children.filter((e) => "tag" in e)];
			} else {
				if (entry.children && !collapsed) {
					cx = [...cx, ...entry.children.filter((e) => "tag" in e)];
				}
				if (
					_maxDepth != 1 &&
					currentDepth > _maxDepth &&
					entry.allDescendants &&
					!collapsed
				) {
					cx = [...cx, ...entry.allDescendants];
				}
				if (entry.descendants && !collapsed) {
					cx = [...cx, ...entry.descendants];
				}
			}
			children = cx;
		}
	}
</script>

<slot>
	{#if showOnlyChildren}
		{#if children.length > 0}
			{#each children as item}
				<svelte:self
					entry={item}
					{openfile}
					{hoverPreview}
					{expandFolder}
					{showMenu}
					skippedTag={tagTitle}
					path={currentPath}
				/>
			{/each}
		{/if}
	{:else if "tag" in entry && (currentDepth <= _maxDepth || entry.tag.startsWith(SUBTREE_MARK))}
		<div class="nav-folder" class:is-collapsed={collapsed}>
			<div
				class="nav-folder-title"
				class:is-active={entry.children && collapsed && isSelected}
				on:click={() => toggleFolder(entry)}
				on:contextmenu={contextMenuFunc(entry)}
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
						{tagTitle}
					</div>
					<div class="tagfolder-quantity">{entry.itemsCount}</div>
				</div>
			</div>
			{#if children.length > 0}
				<div class="nav-folder-children">
					{#each children as item}
						<svelte:self
							entry={item}
							{openfile}
							{hoverPreview}
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
				on:mouseover={(e) => handleMouseover(e, entry)}
				on:focus={() => {
					/* ignore aria complaint */
				}}
				on:contextmenu={contextMenuFunc(entry)}
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
