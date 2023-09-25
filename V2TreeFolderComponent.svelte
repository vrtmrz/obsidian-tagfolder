<script lang="ts">
	import {
		type TREE_TYPE,
		type TagFolderSettings,
		type TagInfoDict,
		type ViewItem,
	} from "types";
	import {
		renderSpecialTag,
		escapeStringToHTML,
		selectCompareMethodTags,
		joinPartialPath,
		parseTagName,
		removeIntermediatePath,
		trimTrailingSlash,
		uniqueCaseIntensive,
		type V2FolderItem,
		V2FI_IDX_CHILDREN,
		trimSlash,
		doEvents,
		ancestorToLongestTag,
		ancestorToTags,
		isSpecialTag,
		unique,
		getViewItemFromPath,
		getAllLinksRecursive,
	} from "./util";
	import {
		currentFile,
		selectedTags,
		tagFolderSetting,
		tagInfo,
		v2expandedTags,
	} from "./store";
	import { collectTreeChildren, performSortExactFirst } from "./v2codebehind";
	import TreeItemItemComponent from "V2TreeItemComponent.svelte";
	import OnDemandRender from "OnDemandRender.svelte";
	import { tick } from "svelte";

	// -- Props --

	export let viewType: TREE_TYPE = "tags";

	// Name of this tag, including intermediate levels if we are inside.
	export let thisName = "";

	$: filename =
		viewType == "tags" ? "" : thisName.substring(thisName.indexOf(":") + 1);

	// All contained items.
	// **Be careful**: Please keep the order of this. This should be already sorted.
	export let items = [] as ViewItem[];
	let _items = [] as ViewItem[];

	// Name of this tag, we can use it to sort or something.
	export let tagName = "";

	// Convert tagName to display,
	export let tagNameDisp = [] as string[];

	// The trail that we have passed.
	export let trail = [] as string[];

	// If it is the root.
	export let isRoot: boolean;

	// A.k.a `is not a list`.
	export let isMainTree: boolean;

	// The depth of this node; is not incremented inside the nested tag.
	export let depth = 1;

	// Icons (Just for layout)
	export let folderIcon: string = "";

	// The title (Only used at the root)
	export let headerTitle: string = "";

	// -- Callbacks --
	export let showMenu: (
		evt: MouseEvent,
		trail: string[],
		targetTag?: string,
		targetItems?: ViewItem[]
	) => void;
	export let openFile: (path: string, specialKey: boolean) => void;
	export let hoverPreview: (e: MouseEvent, path: string) => void;
	export let openScrollView: (
		leaf: null,
		title: string,
		tagPath: string,
		files: string[]
	) => Promise<void>;

	// The key for keep toggling
	$: trailKey = trail.join("*");
	$: collapsed = !isRoot && !$v2expandedTags.has(trailKey);

	v2expandedTags.subscribe((expTags) => {
		if (trailKey == undefined) return;
		const collapsedNew = !expTags.has(trailKey);
		if (collapsed != collapsedNew) {
			collapsed = collapsedNew;
		}
	});

	// Watch them to realise the configurations to display immediately
	let _setting = $tagFolderSetting as TagFolderSettings;
	let expandLimit = 0;
	tagFolderSetting.subscribe((setting) => {
		_setting = setting;
		expandLimit = 0;
		if (_setting.expandLimit) {
			if (viewType == "links") {
				expandLimit = _setting.expandLimit + 1;
			} else {
				expandLimit = _setting.expandLimit;
			}
		}
	});
	let _tagInfo: TagInfoDict = {};
	tagInfo.subscribe((info: TagInfoDict) => {
		_tagInfo = info;
	});
	$: sortFunc = selectCompareMethodTags(
		_setting,
		viewType == "links" ? {} : _tagInfo
	);

	// To Highlight active things.
	let _currentActiveFilePath = "";
	currentFile.subscribe((path) => {
		_currentActiveFilePath = path;
	});

	// Event handlers
	function handleOpenScroll(
		e: MouseEvent,
		trails: string[],
		filePaths: string[]
	) {
		if (viewType == "tags") {
			openScrollView(
				null,
				"",
				joinPartialPath(removeIntermediatePath(trails)).join(", "),
				filePaths
			);
		} else if (viewType == "links") {
			openScrollView(null, "", `Linked to ${filename}`, filePaths);
		}
		e.preventDefault();
	}
	function shouldResponsibleFor(evt: MouseEvent) {
		if (
			evt.target instanceof Element &&
			evt.target.matchParent(
				".is-clickable.mod-collapsible.nav-folder-title"
			)
		) {
			return true;
		}
		return false;
	}

	function toggleFolder(evt: MouseEvent) {
		if (shouldResponsibleFor(evt)) {
			evt.preventDefault();
			evt.stopPropagation();

			// Do not toggle this tree directly.
			if (_setting.useMultiPaneList) {
				selectedTags.set(trail);
			}
			v2expandedTags.update((evt) => {
				if (evt.has(trailKey)) {
					evt.delete(trailKey);
				} else {
					evt.add(trailKey);
				}
				return evt;
			});
		}
	}

	// All tags that this node have.
	let tags = [] as string[];

	// Dedicated tag -- Nested tags -- handling
	let isInDedicatedTag = false;
	let previousTrail = "";

	// To suppress empty folders
	let isSuppressibleLevel = false;
	let suppressLevels = [] as string[];

	// Sub-folders
	let children = [] as V2FolderItem[];
	// Sub-folders for display (Used for phased UI update)
	let childrenDisp = [] as V2FolderItem[][];

	// Items on this level; which had not been contained in sub-trees.
	// **Be careful**: Please keep the order of this. This should be also already sorted.
	let leftOverItems = [] as ViewItem[];
	// and for display
	let leftOverItemsDisp = [] as ViewItem[][];

	// Current tag name for display.
	let tagsDisp = [] as string[][];

	// Just for convenience.
	$: trailLower = trail.map((e) => e.toLowerCase());

	// Change detection
	$: {
		if (JSON.stringify(items) !== JSON.stringify(_items)) {
			_items = items;
		}
	}

	let thisLinks = [] as string[];
	let thisInfo: ViewItem | undefined;
	$: {
		thisLinks = [];
		thisInfo = undefined;
		if (viewType == "links") {
			thisInfo = getViewItemFromPath(thisName);
			thisLinks = (thisInfo?.links ?? []).map((e) => `${e}`);
		}
	}

	// Items which should be used in LinkFolder.
	let linkedItems = new Map<string, ViewItem[]>();
	// Updating structure
	$: {
		linkedItems.clear();
		isInDedicatedTag = false;
		let isMixedDedicatedTag = false;
		if (_items) {
			tags = [];
			previousTrail = "";
			if (trail.length >= 1 && trail[trail.length - 1].endsWith("/")) {
				// If in the middle of tag.
				previousTrail = trail[trail.length - 1];
				isInDedicatedTag = true;
				isMixedDedicatedTag = true;
			}

			if (
				isMainTree &&
				(!expandLimit || (expandLimit && depth < expandLimit))
			) {
				isSuppressibleLevel = false;
				isMixedDedicatedTag = false;
				let tagsAll = uniqueCaseIntensive(
					_items.flatMap((e) => [...e.tags])
				);
				if (viewType == "links") {
					tagsAll = unique(_items.flatMap((e) => [...e.links]));
					if (!isRoot) {
						tagsAll = thisLinks;
						if (!_setting.linkShowOnlyFDR) {
							tagsAll = thisInfo
								? getAllLinksRecursive(thisInfo, [...trail])
								: thisLinks;
						}
					}
					if (!isRoot || _setting.expandUntaggedToRoot) {
						tagsAll = tagsAll.filter((e) => e != "_unlinked");
					}

					tagsAll = tagsAll.filter((e) => !trail.contains(e));
					for (const tag of tagsAll) {
						if (tag == "_unlinked") {
							linkedItems.set(
								tag,
								_items.filter((e) => e.links.contains(tag))
							);
						} else {
							const wItems = _items.filter((e) => e.path == tag);
							linkedItems.set(tag, wItems);
						}
					}
					tags = [];
					leftOverItems = [];
					if (thisName == "_unlinked") {
						leftOverItems = _items;
					} else {
						tagsAll.forEach((tag) => {
							if (tag == "_unlinked") {
								tags.push(tag);
								return;
							}
							const x = getViewItemFromPath(tag);
							if (x == undefined) return false;
							const existLinks = x.links.filter(
								(e) => !trail.contains(e) && e != thisName
							);

							// Show as a tag,
							// if there are two or more items under the tag,
							// and it has not reached the expanding limit.
							const nextDepth =
								!expandLimit ||
								(expandLimit && depth + 1 < expandLimit);
							if (existLinks.length >= 2 && nextDepth) {
								tags.push(tag);
							} else {
								// Otherwise, show as files.
								leftOverItems.push(x);
							}
						});
					}
				} else {
					const lastTrailTagLC =
						trimTrailingSlash(previousTrail).toLowerCase();

					// If there are intermediate or normal tag, cancel inDedicatedTag.
					if (
						isInDedicatedTag &&
						tagsAll.some((e) => e.toLowerCase() == lastTrailTagLC)
					) {
						isInDedicatedTag = false;
					}

					let existTags = [...tagsAll];

					// trimming tags

					// Remove tags which already visited
					existTags = existTags.filter((tag) =>
						trail.every(
							(trail) =>
								trimTrailingSlash(tag.toLowerCase()) !==
								trimTrailingSlash(trail.toLowerCase())
						)
					);

					// Remove itself
					existTags = existTags.filter(
						(tag) =>
							tag.toLowerCase() != thisName.toLowerCase() &&
							tag.toLowerCase() != tagName.toLowerCase()
					);
					existTags = existTags.filter(
						(tag) =>
							!tag
								.toLowerCase()
								.endsWith(
									"/" + trimSlash(thisName).toLowerCase()
								)
					);

					let escapedPreviousTrail = previousTrail;

					if (isInDedicatedTag) {
						// Dedicated tag does not accept other items on the intermediate places.

						existTags = existTags.filter((e) =>
							(e + "/").startsWith(previousTrail)
						);
					}
					if (isMixedDedicatedTag) {
						// Escape slash to grouping tags.
						escapedPreviousTrail = previousTrail
							.split("/")
							.join("*");
						existTags = existTags.map((e) =>
							(e + "/").startsWith(previousTrail)
								? escapedPreviousTrail +
								  e.substring(previousTrail.length)
								: e
						);
					}

					let existTagsFiltered1 = [] as string[];
					if (!_setting.doNotSimplifyTags) {
						// If the note has only one item. it can be suppressible.
						if (_items.length == 1) {
							existTagsFiltered1 = existTags;
							isSuppressibleLevel = true;
						} else {
							// All tags under this note are the same. it can be suppressible
							const allChildTags = uniqueCaseIntensive(
								_items.map((e) => e.tags.sort().join("**"))
							);
							if (allChildTags.length == 1) {
								isSuppressibleLevel = true;
								existTagsFiltered1 = existTags;
							}
						}
					}

					if (!isSuppressibleLevel) {
						// Collect tags and pieces of nested tags, for preparing a list of
						// tags (or subsequent part of nested-tag) on the next level.

						// At least, this tag name should be trimmed.
						const removeItems = [thisName.toLowerCase()];
						if (_setting.reduceNestedParent) {
							// If reduceNestedParent is enabled, passed trails also should be trimmed.
							removeItems.push(...trailLower);
						}
						let tagsOnNextLevel = [] as string[];
						if (viewType == "tags") {
							tagsOnNextLevel = uniqueCaseIntensive(
								existTags.map((e) => {
									const idx = e.indexOf("/");
									if (idx < 1) return e;
									let piece = e.substring(0, idx + 1);
									let idx2 = idx;
									while (
										removeItems.contains(
											piece.toLowerCase()
										)
									) {
										idx2 = e.indexOf("/", idx2 + 1);
										if (idx2 === -1) {
											piece = e;
											break;
										}
										piece = e.substring(0, idx2 + 1);
									}
									return piece;
								})
							);
						} else {
							tagsOnNextLevel = unique(existTags);
						}
						const trailShortest = removeIntermediatePath(trail);
						existTagsFiltered1 = tagsOnNextLevel.filter((tag) =>
							// Remove tags which in trail again.
							trailShortest.every(
								(trail) =>
									trimTrailingSlash(tag.toLowerCase()) !==
									trimTrailingSlash(trail.toLowerCase())
							)
						);
					}

					// To use as a filter, the previous level should be included in the tags list if in the dedicated level.
					if (isMixedDedicatedTag) {
						existTagsFiltered1 = existTagsFiltered1.map((e) =>
							e.replace(escapedPreviousTrail, previousTrail)
						);
					}

					// Merge the tags of dedicated tag and normal tag
					const existTagsFiltered1LC = existTagsFiltered1.map((e) =>
						e.toLowerCase()
					);
					const existTagsFiltered2 = existTagsFiltered1.map((e) =>
						existTagsFiltered1LC.contains(e.toLowerCase() + "/")
							? e + "/"
							: e
					);
					const existTagsFiltered3 =
						uniqueCaseIntensive(existTagsFiltered2);
					if (previousTrail.endsWith("/")) {
						const existTagsFiltered4 = [] as string[];
						for (const tag of existTagsFiltered3) {
							if (
								!existTagsFiltered3
									.map((e) => e.toLowerCase())
									.contains(
										(previousTrail + tag).toLowerCase()
									)
							) {
								existTagsFiltered4.push(tag);
							}
						}
						tags = uniqueCaseIntensive(
							removeIntermediatePath(existTagsFiltered4)
						);
					} else {
						tags = uniqueCaseIntensive(
							removeIntermediatePath(existTagsFiltered3)
						);
					}
				}
			}
		}
	}

	// --> Dirty area
	// Collect sub-folders.
	let nextQueue: ReturnType<typeof setTimeout> = undefined;
	const key = trail.join("/");
	let running = false;
	function updateChildren(_: unknown) {
		if (running) {
			if (nextQueue !== undefined) {
				clearTimeout(nextQueue);
			}
			nextQueue = setTimeout(() => {
				nextQueue = undefined;
				updateChildren(undefined);
			}, 300);
			return;
		}
		running = true;
		collectTreeChildren({
			key,
			expandLimit,
			depth,
			tags,
			trailLower,
			_setting,
			isMainTree,
			isSuppressibleLevel,
			viewType,
			previousTrail,
			_tagInfo,
			_items,
			linkedItems,
			isRoot,
			sortFunc,
		})
			.then((ret) => {
				children = ret.children;
				suppressLevels = ret.suppressLevels;
			})
			.finally(() => {
				running = false;
			});
	}
	$: {
		// Do not use any params on the function, but we want to watch.
		updateChildren({
			expandLimit,
			depth,
			tags,
			trailLower,
			_setting,
			isMainTree,
			isSuppressibleLevel,
			viewType,
			previousTrail,
			_tagInfo,
			_items,
			linkedItems,
			isRoot,
			sortFunc,
		});
	}

	// <-- Dirty area

	// -- Displaying

	$: isActive =
		(_items && _items.some((e) => e.path == _currentActiveFilePath)) ||
		(viewType == "links" &&
			(thisName == _currentActiveFilePath ||
				tags.contains(_currentActiveFilePath) ||
				leftOverItems.some((e) => e.path == _currentActiveFilePath)));
	$: {
		// I wonder actually this is meaningful; tagName and tagNameDisp should be shown
		if (tagName == "" && tagNameDisp.length == 0) {
			const [wTagName, wTagNameDisp] = parseTagName(thisName, _tagInfo);
			tagName = wTagName;
			tagNameDisp = wTagNameDisp;
		}
	}

	// Create tags that we actually see.
	$: {
		if (isSuppressibleLevel && isInDedicatedTag) {
			tagsDisp = [
				[
					...tagNameDisp,
					...suppressLevels.flatMap((e) =>
						e.split("/").map((e) => renderSpecialTag(e))
					),
				],
			];
		} else if (isSuppressibleLevel) {
			tagsDisp = [
				tagNameDisp,
				...suppressLevels.map((e) =>
					e.split("/").map((e) => renderSpecialTag(e))
				),
			];
		} else {
			tagsDisp = [tagNameDisp];
		}
	}
	// To improve performance, make HTML in advance.
	$: classKey = viewType == "links" ? " tf-link" : " tf-tag";
	$: tagsDispHtml = isFolderVisible
		? tagsDisp
				.map(
					(e) =>
						`<span class="tagfolder-tag tag-tag${classKey}">${e
							.map(
								(ee) =>
									`<span class="tf-tag-each">${escapeStringToHTML(
										ee
									)}</span>`
							)
							.join("")}</span>`
				)
				.join("")
		: "";

	// -- Filter the items by already shown ones to make the list that is shown in this level directly.
	$: {
		if (_setting.useMultiPaneList && isMainTree) {
			leftOverItems = [];
		} else {
			if (isRoot && isMainTree && !isSuppressibleLevel) {
				// The root, except not is suppressible.
				if (_setting.expandUntaggedToRoot) {
					leftOverItems = _items.filter(
						(e) =>
							e.tags.contains("_untagged") ||
							e.tags.contains("_unlinked")
					);
				} else {
					leftOverItems = [];
				}
			} else if (isRoot && !isMainTree) {
				// Separated List;
				leftOverItems = _items;
			} else if (viewType == "tags") {
				if (_setting.hideItems == "NONE") {
					leftOverItems = _items;
				} else if (
					(_setting.hideItems == "DEDICATED_INTERMIDIATES" &&
						isInDedicatedTag) ||
					_setting.hideItems == "ALL_EXCEPT_BOTTOM"
				) {
					leftOverItems = _items.filter(
						(e) =>
							!children
								.map((e) => e[V2FI_IDX_CHILDREN])
								.flat()
								.find((ee) => e.path == ee.path)
					);
				} else {
					leftOverItems = _items;
				}
			}
		}
		if (_setting.sortExactFirst) {
			leftOverItems = performSortExactFirst(
				_items,
				children,
				leftOverItems
			);
		}
	}
	let isFolderVisible = false;

	$: itemCount =
		viewType == "tags"
			? _items?.length ?? 0
			: tags.length + leftOverItems.length;

	// -- Phased UI update --

	// For preventing UI freezing, split items into batches and apply them at intervals.
	const batchSize = 20;
	function splitArrayToBatch<T>(items: T[]): T[][] {
		const ret = [] as T[][];
		if (items && items.length > 0) {
			const applyItems = [...items];
			do {
				const batch = applyItems.splice(0, batchSize);
				if (batch.length == 0) {
					break;
				}
				ret.push(batch);
				if (batch.length < batchSize) {
					break;
				}
			} while (applyItems.length > 0);
		}
		return ret;
	}

	let queueLeftOverItems = [] as ViewItem[];
	let batchedLeftOverItems = [] as ViewItem[][];
	async function applyLeftOverItems(items: ViewItem[]) {
		if (batchedLeftOverItems.length != 0) {
			// Processing, queue for next
			queueLeftOverItems = items;
			return;
		}

		// If once drawn, patching will work fine.
		if (leftOverItemsDisp.length != 0) {
			// TODO: If performance issue has occurred, check the ratio of the dirty ones.
			leftOverItemsDisp = splitArrayToBatch(items);
			return;
		}
		try {
			const allOfBatch = splitArrayToBatch(items);
			if (
				JSON.stringify(leftOverItemsDisp) == JSON.stringify(allOfBatch)
			) {
				return;
			}
			batchedLeftOverItems = allOfBatch;
			queueLeftOverItems = [];
			leftOverItemsDisp = [];
			for (const batch of batchedLeftOverItems) {
				leftOverItemsDisp = [...leftOverItemsDisp, batch];
				if (batch.length == batchSize) {
					await doEvents();
					await tick();
				}
				if (queueLeftOverItems.length > 0) {
					// If enqueued while processing, stop all process and leave it to next.
					const p = queueLeftOverItems;
					queueLeftOverItems = [];
					batchedLeftOverItems = [];
					return applyLeftOverItems(p);
				}
			}
		} finally {
			batchedLeftOverItems = [];
		}
	}
	let queuedChildrenDisp = [] as V2FolderItem[];
	let batchedChildren = [] as V2FolderItem[][];
	// Very similar as though it looks the same, now.
	async function applyChildren(items: V2FolderItem[]) {
		if (batchedChildren.length != 0) {
			// Processing, queue for next
			queuedChildrenDisp = items;
			return;
		}
		// If once drawn, patching will work fine.
		if (childrenDisp.length != 0) {
			// TODO: If performance issue has occurred, check the ratio of the dirty ones.
			childrenDisp = splitArrayToBatch(items);
			return;
		}
		try {
			const allOfBatch = splitArrayToBatch(items);
			if (JSON.stringify(childrenDisp) == JSON.stringify(allOfBatch)) {
				return;
			}
			batchedChildren = allOfBatch;
			childrenDisp = [];
			for (const batch of batchedChildren) {
				childrenDisp = [...childrenDisp, batch];
				if (batch.length == batchSize) {
					await doEvents();
					await tick();
				}
				if (queuedChildrenDisp.length > 0) {
					const p = queuedChildrenDisp;
					queuedChildrenDisp = [];
					batchedChildren = [];
					return applyChildren(p);
				}
			}
		} finally {
			batchedChildren = [];
		}
	}
	$: {
		applyLeftOverItems(leftOverItems);
	}
	$: {
		applyChildren(children);
	}
	// -- Dragging ---
	$: draggable = !_setting.disableDragging;

	//@ts-ignore internal API
	const dm = app.dragManager;

	function dragStartFiles(args: DragEvent) {
		if (!draggable) return;
		const files = _items.map((e) =>
			app.vault.getAbstractFileByPath(e.path)
		);
		const param = dm.dragFiles(args, files);
		if (param) {
			return dm.onDragStart(args, param);
		}
	}
	function dragStartName(args: DragEvent) {
		if (!draggable) return;
		if (viewType == "links") {
			return dragStartFile(args);
		}
		const expandedTagsAll = [
			...ancestorToLongestTag(
				ancestorToTags(
					joinPartialPath(
						removeIntermediatePath([...trail, ...suppressLevels])
					)
				)
			),
		].map((e) => trimTrailingSlash(e));
		const expandedTags = expandedTagsAll
			.map((e) =>
				e
					.split("/")
					.filter((ee) => !isSpecialTag(ee))
					.join("/")
			)
			.filter((e) => e != "")
			.map((e) => "#" + e)
			.join(" ")
			.trim();
		(args as any).dataTransfer.setData("text/plain", expandedTags);
		(args as any).dataTransfer.setData("Text", expandedTags);
		(args as any).title = expandedTags;
		(args as any).draggable = true;

		dm.onDragStart(args, args);
	}
	function dragStartFile(args: DragEvent) {
		if (!draggable) return;
		const file = app.vault.getAbstractFileByPath(filename);
		const param = dm.dragFile(args, file);
		if (param) {
			return dm.onDragStart(args, param);
		}
	}
	function handleOpenItem(evt: MouseEvent) {
		if (viewType == "tags") return;
		evt.preventDefault();
		evt.stopPropagation();
		openFile(filename, evt.metaKey || evt.ctrlKey);
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class={`tree-item nav-folder${collapsed ? " is-collapsed" : ""}${
		isRoot ? " mod-root" : ""
	}`}
	on:click|stopPropagation={toggleFolder}
	on:contextmenu|stopPropagation={(evt) => {
		if (shouldResponsibleFor(evt))
			showMenu(
				evt,
				[...trail, ...suppressLevels],
				viewType == "tags" ? tagName : filename,
				_items
			);
	}}
>
	{#if isRoot || !isMainTree}
		{#if isRoot}
			<div class="tree-item-self nav-folder-title">
				<div class="tree-item-inner nav-folder-title-content">
					{headerTitle}
				</div>
			</div>
		{/if}
	{:else}
		<OnDemandRender
			cssClass={`tree-item-self${
				!isRoot ? " is-clickable mod-collapsible" : ""
			} nav-folder-title tag-folder-title${isActive ? " is-active" : ""}`}
			bind:isVisible={isFolderVisible}
		>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<div
				class="tree-item-icon collapse-icon nav-folder-collapse-indicator"
				class:is-collapsed={collapsed}
				on:click={toggleFolder}
			>
				{#if isFolderVisible}
					{@html folderIcon}
				{:else}
					<svg class="svg-icon" />
				{/if}
			</div>
			<div
				class="tree-item-inner nav-folder-title-content lsl-f"
				on:click={handleOpenItem}
			>
				{#if isFolderVisible}
					<div
						class="tagfolder-titletagname"
						{draggable}
						on:dragstart={dragStartName}
					>
						{@html tagsDispHtml}
					</div>
				{:else}
					<div class="tagfolder-titletagname">...</div>
				{/if}
				<div
					class="tagfolder-quantity itemscount"
					on:click={(e) =>
						handleOpenScroll(
							e,
							trail,
							_items.map((e) => e.path)
						)}
				>
					<span
						class="itemscount"
						{draggable}
						on:dragstart={dragStartFiles}>{itemCount}</span
					>
				</div>
			</div>
		</OnDemandRender>
	{/if}
	<!-- Tags and leftover items -->
	{#if !collapsed}
		<div class="tree-item-children nav-folder-children">
			{#each childrenDisp as items}
				{#each items as [f, tagName, tagNameDisp, subitems]}
					<svelte:self
						{viewType}
						items={subitems}
						thisName={f}
						trail={[...trail, ...suppressLevels, f]}
						{folderIcon}
						{openFile}
						isRoot={false}
						{showMenu}
						{isMainTree}
						{openScrollView}
						{hoverPreview}
						{tagName}
						{tagNameDisp}
						depth={isInDedicatedTag ? depth : depth + 1}
					/>
				{/each}
			{/each}
			{#each leftOverItemsDisp as items}
				{#each items as item}
					<TreeItemItemComponent
						{item}
						{openFile}
						trail={isRoot
							? [...trail]
							: [...trail, ...suppressLevels]}
						{showMenu}
						{hoverPreview}
					/>
				{/each}
			{/each}
		</div>
	{/if}
</div>
