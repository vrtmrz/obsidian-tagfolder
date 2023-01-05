<script lang="ts">
	import {
		currentFile,
		maxDepth,
		tagInfo,
		tagFolderSetting,
		selectedTags,
	} from "./store";
	import {
		TreeItem,
		TagFolderItem,
		SUBTREE_MARK_REGEX,
		SUBTREE_MARK,
		TagFolderSettings,
		DEFAULT_SETTINGS,
	} from "./types";
	import {
		ancestorToLongestTag,
		ancestorToTags,
		isAutoExpandTree,
		omittedTags,
		renderSpecialTag,
	} from "./util";
	import type { TagInfoDict } from "./types";
	export let entry: TagFolderItem;
	export let hoverPreview: (e: MouseEvent, path: string) => void;
	export let openfile: (path: string, specialKey: boolean) => void;
	export let expandFolder: (entry: TagFolderItem, expanded: boolean) => void;
	export let showMenu: (
		evt: MouseEvent,
		path: string,
		entry: TagFolderItem
	) => void;
	export let path: string;
	export let skippedTag: string;
	export let openScrollView: (
		leaf: null,
		title: string,
		tagPath: string,
		files: string[]
	) => Promise<void>;

	export let folderIcon: string;
	export let isMainTree: Boolean;
	export let parentTags: string[];

	let collapsed = true;
	let isSelected = false;

	function getItemPath(item: TagFolderItem, basepath?: string) {
		if (item && "tag" in item) {
			return basepath + item.tag + "/";
		}
		return basepath;
	}
	$: currentPath =
		getItemPath(entry, path) + omitTags.map((e) => "/" + e).join("");

	const currentDepth = path
		.replace(SUBTREE_MARK_REGEX, "###")
		.split("/").length;
	let _maxDepth = currentDepth + 1;

	let setting: TagFolderSettings = JSON.parse(
		JSON.stringify(DEFAULT_SETTINGS)
	);
	tagFolderSetting.subscribe((newSetting) => {
		setting = newSetting;
	});
	function toggleFolder(evt: MouseEvent, entry: TagFolderItem) {
		if (
			evt.target instanceof HTMLElement &&
			evt.target.hasClass("itemscount")
		)
			return;
		if ("tag" in entry) {
			expandFolder(entry, collapsed);
			collapsed = !collapsed;
			if (setting.useMultiPaneList) {
				selectedTags.set(entry.ancestors);
			}
		}
	}
	function toggleFolderTitle(evt: MouseEvent, entry: TagFolderItem) {
		toggleFolder(evt, entry);
		return;
	}

	function getFilenames(entry: TreeItem) {
		if (entry.allDescendants == null) {
			return [];
		} else {
			const filenames = entry.allDescendants.map((e) => e.path);
			return Array.from(new Set([...filenames]));
		}
	}

	function openfileLocal(entry: TagFolderItem, evt: MouseEvent) {
		if ("path" in entry) openfile(entry.path, evt.metaKey || evt.ctrlKey);
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
	function handleOpenScroll(e: MouseEvent, entry: TagFolderItem) {
		if ("tag" in entry) {
			openScrollView(
				null,
				"",
				entry.ancestors.join("/"),
				entry.allDescendants.map((e) => e.path)
			);
			e.preventDefault();
		}
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
	let ellipsisMark = "";
	let omitTags = [] as string[];
	let omitTagSrc = [] as string[];
	$: {
		showOnlyChildren = false;
		ellipsisMark = "";
		omitTags = [];
		omitTagSrc = [];
		if ("tag" in entry) {
			showOnlyChildren = isAutoExpandTree(entry, setting);
			const omitTag = omittedTags(entry, setting);
			if (omitTag !== false) {
				omitTagSrc = omitTag;
				omitTags = [
					...omitTag.map((e) =>
						e
							.split("/")
							.map((ee) => renderSpecialTag(ee))
							.join("/")
					),
				];
				ellipsisMark =
					" " + omitTags.join(" ").replace(/\//g, SUBTREE_MARK);
			}
		}
	}

	$: convertedTag = "tag" in entry ? renderSpecialTag(entry.tag) : "";
	$: tagTitle =
		"tag" in entry
			? `${
					skippedTag
						? `${skippedTag}${
								entry.tag.startsWith(SUBTREE_MARK) ? " " : " "
						  }`
						: ""
			  }${tagMark}${convertedTag}`
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
	let entryLeftTags = [] as string[];
	$: {
		entryLeftTags = [];
		if ("tags" in entry) {
			const tempTags = [
				...("tags" in entry ? entry.tags : ([] as string[])),
			];
			const removeTags = [
				...ancestorToLongestTag(
					ancestorToTags(parentTags.filter((e) => e) ?? [])
				),
			];
			let filteredTags = [...tempTags];
			for (const removeTag of removeTags) {
				const part = removeTag.split("/");
				for (const piece of part)
					filteredTags = filteredTags.map((e) =>
						e == piece
							? ""
							: e.startsWith(piece + "/")
							? e.substring(piece.length + 1)
							: e
					);
			}
			entryLeftTags = filteredTags
				.filter((e) => e.trim() != "")
				.map((e) => renderSpecialTag(e));
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
					{openScrollView}
					skippedTag={tagTitle}
					path={currentPath}
					{folderIcon}
					{isMainTree}
					parentTags={[
						...parentTags,
						...omitTagSrc,
						"tag" in item ? item.tag : undefined,
					]}
				/>
			{/each}
		{/if}
	{:else if "tag" in entry && (currentDepth <= _maxDepth || entry.tag.startsWith(SUBTREE_MARK))}
		<div class="nav-folder" class:is-collapsed={collapsed}>
			<div
				class="nav-folder-title tag-folder-title"
				class:is-active={entry.children && collapsed && isSelected}
				on:click={(evt) => toggleFolder(evt, entry)}
				on:contextmenu={contextMenuFunc(entry)}
			>
				<div class="nav-folder-collapse-indicator collapse-icon">
					{@html folderIcon}
				</div>
				<div class="nav-folder-title-content lsl-f">
					<div class="tagfolder-titletagname">
						{tagTitle}{ellipsisMark}
					</div>
					<div
						class="tagfolder-quantity itemscount"
						on:click={(e) => handleOpenScroll(e, entry)}
					>
						<span class="itemscount">{entry.itemsCount}</span>
					</div>
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
							{openScrollView}
							path={currentPath}
							{folderIcon}
							{isMainTree}
							parentTags={[
								...parentTags,
								...omitTagSrc,
								"tag" in item ? item.tag : undefined,
							]}
						/>
					{/each}
				</div>
			{/if}
		</div>
	{:else if "path" in entry && ((setting.useMultiPaneList && !isMainTree) || !setting.useMultiPaneList)}
		<div class="nav-file">
			<div
				class="nav-file-title"
				class:is-active={isSelected}
				on:click={(evt) => openfileLocal(entry, evt)}
				on:mouseover={(e) => handleMouseover(e, entry)}
				on:focus={() => {
					/* ignore aria complaint */
				}}
				on:contextmenu={contextMenuFunc(entry)}
			>
				<div class="nav-file-title-content lsl-f">
					{entry.displayName}
				</div>
				<div class="taglist">
					{#each entryLeftTags as leftTag}
						<span class="tags">{leftTag}</span>
					{/each}
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
		overflow: visible;
		max-width: calc(100% - var(--nav-item-parent-padding));
	}
	.tags {
		background-color: var(--background-secondary-alt);
		border-radius: 4px;
		padding: 2px 4px;
		margin-left: 4px;
	}
	.taglist {
		white-space: nowrap;
		text-overflow: ellipsis;
		padding-left: 1em;
		overflow: hidden;
	}
	.tagfolder-titletagname {
		flex-grow: 1;
		max-width: calc(100% - 2em);
		width: calc(100% - 2em);
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
		overflow: hidden;
	}
	.nav-folder-title-content:hover .tagfolder-quantity span {
		background-color: var(--interactive-accent-hover);
		color: var(--text-on-accent);
	}
	.tagfolder-quantity span {
		background-color: var(--background-secondary-alt);
		border-radius: 4px;
		padding: 2px 4px;
	}
	.tagfolder-quantity {
		width: 3em;
		text-align: right;
		cursor: pointer;
	}

	.tag-folder-title {
		max-width: 100%;
	}
</style>
