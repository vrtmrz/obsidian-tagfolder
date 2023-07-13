<script lang="ts">
	import {
		type TagFolderSettings,
		type TagInfoDict,
		type ViewItem,
	} from "types";
	import {
		renderSpecialTag,
		escapeStringToHTML,
		selectCompareMethodTags,
		getExtraTags,
		joinPartialPath,
		parseTagName,
		pathMatch,
		removeIntermediatePath,
		trimTrailingSlash,
		uniqueCaseIntensive,
		type V2FolderItem,
		V2FI_IDX_TAG,
		V2FI_IDX_CHILDREN,
		V2FI_IDX_TAGDISP,
		V2FI_IDX_TAGNAME,
		trimPrefix,
		trimSlash,
		doEvents,
	} from "./util";
	import {
		currentFile,
		selectedTags,
		tagFolderSetting,
		tagInfo,
		v2expandedTags,
	} from "./store";
	import TreeItemItemComponent from "V2TreeItemComponent.svelte";
	import OnDemandRender from "OnDemandRender.svelte";
	import { tick } from "svelte";

	// -- Props --

	// Name of this tag, including intermediate levels if we are inside.
	export let thisName = "";

	// All contained items.
	// **Be careful**: Please keep the order of this. This should be already sorted.
	export let items = [] as ViewItem[];

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
	tagFolderSetting.subscribe((setting) => {
		_setting = setting;
	});
	let _tagInfo: TagInfoDict = {};
	tagInfo.subscribe((info: TagInfoDict) => {
		_tagInfo = info;
	});
	$: sortFunc = selectCompareMethodTags(_setting, _tagInfo);

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
		openScrollView(
			null,
			"",
			joinPartialPath(removeIntermediatePath(trails)).join(", "),
			filePaths
		);
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
	$: trailLower = trail.map((e) => e.toLocaleLowerCase());

	// Updating structure
	$: {
		isInDedicatedTag = false;
		if (items) {
			tags = [];
			previousTrail = "";
			if (trail.length >= 1 && trail[trail.length - 1].endsWith("/")) {
				// If in the middle of tag.
				previousTrail = trail[trail.length - 1];
				isInDedicatedTag = true;
			}

			if (
				isMainTree &&
				(!_setting?.expandLimit ||
					(_setting?.expandLimit && depth < _setting.expandLimit))
			) {
				isSuppressibleLevel = false;

				const tagsAll = uniqueCaseIntensive(
					items.flatMap((e) => [...e.tags])
				);

				const lastTrailTagLC =
					trimTrailingSlash(previousTrail).toLocaleLowerCase();

				// If there are intermediate or normal tag, cancel inDedicatedTag.
				if (
					isInDedicatedTag &&
					tagsAll.some((e) => e.toLocaleLowerCase() == lastTrailTagLC)
				) {
					isInDedicatedTag = false;
				}

				let existTags = [...tagsAll];

				// trimming tags

				// Remove tags which already visited
				existTags = existTags.filter((tag) =>
					trail.every(
						(trail) =>
							trimTrailingSlash(tag.toLocaleLowerCase()) !==
							trimTrailingSlash(trail.toLocaleLowerCase())
					)
				);

				// Remove itself
				existTags = existTags.filter(
					(tag) =>
						tag.toLocaleLowerCase() !=
							thisName.toLocaleLowerCase() &&
						tag.toLocaleLowerCase() != tagName.toLocaleLowerCase()
				);
				existTags = existTags.filter(
					(tag) =>
						!tag
							.toLocaleLowerCase()
							.endsWith(
								"/" + trimSlash(thisName).toLocaleLowerCase()
							)
				);

				if (isInDedicatedTag) {
					// Dedicated tag does not accept other items on the intermediate places.

					existTags = existTags.filter((e) =>
						(e + "/").startsWith(previousTrail)
					);

					// Just split for debugging.

					existTags = existTags.map((e) =>
						(e + "/").startsWith(previousTrail)
							? e.substring(previousTrail.length)
							: e
					);
				}

				let existTagsFiltered1 = [] as string[];
				if (!_setting.doNotSimplifyTags) {
					// If the note has only one item. it can be suppressible.
					if (items.length == 1) {
						existTagsFiltered1 = existTags;
						isSuppressibleLevel = true;
					} else {
						// All tags under this note are the same. it can be suppressible
						const allChildTags = uniqueCaseIntensive(
							items.map((e) => e.tags.sort().join("**"))
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
					const removeItems = [thisName.toLocaleLowerCase()];
					if (_setting.reduceNestedParent) {
						// If reduceNestedParent is enabled, passed trails also should be trimmed.
						removeItems.push(...trailLower);
					}
					const tagsOnNextLevel = uniqueCaseIntensive(
						existTags.map((e) => {
							const idx = e.indexOf("/");
							if (idx < 1) return e;
							let piece = e.substring(0, idx + 1);
							let idx2 = idx;
							while (
								removeItems.contains(piece.toLocaleLowerCase())
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
					existTagsFiltered1 = tagsOnNextLevel.filter((tag) =>
						// Remove tags which in trail again.
						trail.every(
							(trail) =>
								trimTrailingSlash(tag.toLocaleLowerCase()) !==
								trimTrailingSlash(trail.toLocaleLowerCase())
						)
					);
				}

				// To use as a filter, the previous level should be included in the tags list if in the dedicated level.
				if (isInDedicatedTag) {
					existTagsFiltered1 = existTagsFiltered1.map(
						(e) => previousTrail + e
					);
				}

				// Merge the tags of dedicated tag and normal tag
				const existTagsFiltered1LC = existTagsFiltered1.map((e) =>
					e.toLocaleLowerCase()
				);
				const existTagsFiltered2 = existTagsFiltered1.map((e) =>
					existTagsFiltered1LC.contains(e.toLocaleLowerCase() + "/")
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
								.map((e) => e.toLocaleLowerCase())
								.contains(
									(previousTrail + tag).toLocaleLowerCase()
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

	// Collect sub-folders.
	$: {
		suppressLevels = []; // This will be shown as chip.
		if (_setting?.expandLimit && depth >= _setting.expandLimit) {
			// If expand limit had been configured and we have reached it,
			// suppress sub-folders and show that information as extraTags.
			children = [];
			suppressLevels = getExtraTags(
				tags,
				trailLower,
				_setting.reduceNestedParent
			);
		} else if (!isMainTree) {
			// If not in main tree, suppress sub-folders.
			children = [];
		} else if (isSuppressibleLevel) {
			// If we determined it was a suppressible,
			// suppress sub-folders and show that information as extraTags.
			children = [];
			suppressLevels = getExtraTags(
				tags,
				trailLower,
				_setting.reduceNestedParent
			);
		} else {
			const previousTrailLC = previousTrail.toLocaleLowerCase();
			let wChildren = tags
				.map((tag) => {
					const tagLC = tag.toLocaleLowerCase();
					const tagNestedLC = trimPrefix(tagLC, previousTrailLC);
					return [
						tag,
						...parseTagName(tag, _tagInfo),
						items.filter((item) =>
							item.tags.some((itemTag) => {
								const itemTagLC = itemTag.toLocaleLowerCase();
								return (
									pathMatch(itemTagLC, tagLC) || // Exact matched item
									// `b` should be contained in `a/b` under `a/`, if the level is mixed level.
									pathMatch(itemTagLC, tagNestedLC)
								);
							})
						),
					] as V2FolderItem;
				})
				.filter((child) => child[V2FI_IDX_CHILDREN].length != 0);

			wChildren = wChildren.sort(sortFunc);
			// -- Check redundant combination if configured.
			if (_setting.mergeRedundantCombination) {
				let out = [] as typeof wChildren;
				const isShown = new Set<string>();
				for (const [tag, tagName, tagsDisp, items] of wChildren) {
					const list = [] as ViewItem[];
					for (const v of items) {
						if (!isShown.has(v.path)) {
							list.push(v);
							isShown.add(v.path);
						}
					}
					if (list.length != 0)
						out.push([tag, tagName, tagsDisp, list]);
				}
				wChildren = out;
			}

			// -- MainTree and Root specific structure modification.
			if (isMainTree && isRoot) {
				// Remove all items which have been already archived except is on the root.
				const archiveTags = _setting.archiveTags
					.toLocaleLowerCase()
					.replace(/[\n ]/g, "")
					.split(",");
				wChildren = wChildren
					.map((e) =>
						archiveTags.some((aTag) =>
							`${aTag}//`.startsWith(
								e[V2FI_IDX_TAG].toLocaleLowerCase() + "/"
							)
						)
							? e
							: ([
									e[V2FI_IDX_TAG],
									e[V2FI_IDX_TAGNAME],
									e[V2FI_IDX_TAGDISP],
									e[V2FI_IDX_CHILDREN].filter(
										(items) =>
											!items.tags.some((e) =>
												archiveTags.contains(
													e.toLocaleLowerCase()
												)
											)
									),
							  ] as V2FolderItem)
					)
					.filter((child) => child[V2FI_IDX_CHILDREN].length != 0);
			}
			children = wChildren;
		}
	}

	// -- Displaying

	$: isActive = items && items.some((e) => e.path == _currentActiveFilePath);
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
	$: tagsDispHtml = isFolderVisible
		? tagsDisp
				.map(
					(e) =>
						`<span class="tagfolder-tag tag-tag">${e
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
			if (isRoot && isMainTree) {
				// The root
				if (_setting.expandUntaggedToRoot) {
					leftOverItems = items.filter((e) =>
						e.tags.contains("_untagged")
					);
				} else {
					leftOverItems = [];
				}
			} else if (isRoot && !isMainTree) {
				// Separated List;
				leftOverItems = items;
			} else {
				if (_setting.hideItems == "NONE") {
					leftOverItems = items;
				} else if (
					(_setting.hideItems == "DEDICATED_INTERMIDIATES" &&
						isInDedicatedTag) ||
					_setting.hideItems == "ALL_EXCEPT_BOTTOM"
				) {
					leftOverItems = items.filter(
						(e) =>
							!children
								.map((e) => e[V2FI_IDX_CHILDREN])
								.flat()
								.find((ee) => e.path == ee.path)
					);
				} else {
					leftOverItems = items;
				}
			}
		}
	}
	let isFolderVisible = false;

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
	async function applyChildren(items: V2FolderItem[]) {
		if (batchedChildren.length != 0) {
			// Processing, queue for next
			queuedChildrenDisp = items;
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
</script>

{#if isRoot || !isMainTree}
	{#if isRoot}
		{#each childrenDisp as items}
			{#each items as [f, tagName, tagNameDisp, subitems]}
				<svelte:self
					items={subitems}
					thisName={f}
					trail={[f]}
					{folderIcon}
					{openFile}
					{showMenu}
					isRoot={false}
					{isMainTree}
					{openScrollView}
					{hoverPreview}
					{tagName}
					{tagNameDisp}
					depth={depth + 1}
				/>
			{/each}
		{/each}
	{/if}
	{#each leftOverItemsDisp as items}
		{#each items as item}
			<TreeItemItemComponent
				{item}
				{openFile}
				trail={[...trail, ...suppressLevels]}
				{showMenu}
				{hoverPreview}
			/>
		{/each}
	{/each}
{:else}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class={`tree-item nav-folder${collapsed ? " is-collapsed" : ""}`}
		on:click|stopPropagation={toggleFolder}
		on:contextmenu|stopPropagation={(evt) => {
			if (shouldResponsibleFor(evt))
				showMenu(evt, [...trail, ...suppressLevels], tagName, items);
		}}
	>
		<OnDemandRender
			cssClass={`tree-item-self is-clickable mod-collapsible nav-folder-title tag-folder-title${
				isActive ? " is-active" : ""
			}`}
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
			<div class="tree-item-inner nav-folder-title-content lsl-f">
				{#if isFolderVisible}
					<div class="tagfolder-titletagname">
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
							items.map((e) => e.path)
						)}
				>
					<span class="itemscount">{items?.length ?? 0}</span>
				</div>
			</div>
		</OnDemandRender>
		<!-- Tags and leftover items -->
		{#if !collapsed}
			<div class="tree-item-children nav-folder-children">
				{#each childrenDisp as items}
					{#each items as [f, tagName, tagNameDisp, subitems]}
						<svelte:self
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
							trail={[...trail, ...suppressLevels]}
							{showMenu}
							{hoverPreview}
						/>
					{/each}
				{/each}
			</div>
		{/if}
	</div>
{/if}
