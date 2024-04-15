<script lang="ts">
	import {
		allViewItems,
		allViewItemsByLink,
		appliedFiles,
		performHide,
		searchString,
		tagFolderSetting,
	} from "./store";
	import {
		type ViewItem,
		type TagFolderSettings,
		type TREE_TYPE,
	} from "./types";
	import V2TreeFolderComponent from "./V2TreeFolderComponent.svelte";
	import { onDestroy, onMount, tick } from "svelte";
	import { setIcon } from "obsidian";
	import { trimTrailingSlash } from "./util";
	import { setContext } from "svelte";

	export let hoverPreview: (e: MouseEvent, path: string) => void;
	export let openFile: (path: string, specialKey: boolean) => void;
	export let vaultName: string = "";
	export let title: string = "";
	export let tags: string[] = [];
	export let saveSettings: (setting: TagFolderSettings) => Promise<void>;

	export let showMenu: (
		evt: MouseEvent,
		trail: string[],
		targetTag?: string,
		targetItems?: ViewItem[],
	) => void;
	export let showLevelSelect: (evt: MouseEvent) => void;

	export let showOrder: (evt: MouseEvent) => void;

	export let newNote: (evt: MouseEvent) => void;

	export let openScrollView: (
		leaf: undefined,
		title: string,
		tagPath: string,
		files: string[],
	) => Promise<void>;

	export let isViewSwitchable: boolean;
	export let switchView: () => void;
	export let viewType: TREE_TYPE = "tags";
	let isMainTree: boolean;

	let viewItemsSrc = [] as ViewItem[];
	let updatedFiles = [] as string[];
	appliedFiles.subscribe(async (filenames) => {
		updatedFiles = filenames ?? [];
	});

	if (viewType == "tags") {
		allViewItems.subscribe((items) => {
			viewItemsSrc = items;
		});
	} else if (viewType == "links") {
		allViewItemsByLink.subscribe(async (items) => {
			// Remove items for update
			if (viewItemsSrc) {
				const filtered = [
					...viewItemsSrc.filter(
						(e) =>
							!updatedFiles.some((filename) =>
								e.links.contains(filename),
							),
					),
				];
				updatedFiles = [];
				viewItemsSrc = filtered;
				await tick();
			}
			viewItemsSrc = items;
		});
	}
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

	let _setting = $tagFolderSetting as TagFolderSettings;
	let outgoingEnabled = false;
	let incomingEnabled = false;
	let onlyFDREnabled = false;
	tagFolderSetting.subscribe((setting) => {
		_setting = setting;
		outgoingEnabled = _setting.linkConfig?.outgoing?.enabled ?? false;
		incomingEnabled = _setting.linkConfig?.incoming?.enabled ?? false;
		onlyFDREnabled = _setting.linkShowOnlyFDR;
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
	let outgoingIcon = "";
	let incomingIcon = "";
	let linkIcon = "";

	async function switchIncoming() {
		let newSet = { ..._setting };
		newSet.linkConfig.incoming.enabled =
			!_setting.linkConfig.incoming.enabled;
		if (
			!newSet.linkConfig.incoming.enabled &&
			!newSet.linkConfig.outgoing.enabled
		) {
			newSet.linkConfig.incoming.enabled = true;
		}
		if (saveSettings) await saveSettings(newSet);
	}
	async function switchOutgoing() {
		let newSet = { ..._setting };
		newSet.linkConfig.outgoing.enabled =
			!_setting.linkConfig.outgoing.enabled;
		if (
			!newSet.linkConfig.incoming.enabled &&
			!newSet.linkConfig.outgoing.enabled
		) {
			newSet.linkConfig.outgoing.enabled = true;
		}

		if (saveSettings) await saveSettings(newSet);
	}
	async function switchOnlyFDR() {
		let newSet = { ..._setting };
		newSet.linkShowOnlyFDR = !_setting.linkShowOnlyFDR;
		if (saveSettings) await saveSettings(newSet);
	}

	let observer: IntersectionObserver;
	type handler = {
		callback: (visibility: boolean) => void;
		lastState: boolean | undefined;
	};
	let observingElements = new Map<Element, handler>();
	function observe(el: Element, callback: (visibility: boolean) => void) {
		if (observingElements.has(el)) {
			unobserve(el);
		}
		observingElements.set(el, { callback, lastState: undefined });
		observer.observe(el);
	}
	function unobserve(el: Element) {
		observer.unobserve(el);
	}
	setContext("observer", {
		observe,
		unobserve,
	});
	onMount(() => {
		const observingOption = {
			root: scrollParent,
			rootMargin: "40px 0px",
			threshold: 0,
		};
		observer = new IntersectionObserver((ex) => {
			for (const v of ex) {
				if (observingElements.has(v.target)) {
					const tg = observingElements.get(v.target);
					if (tg && tg.lastState !== v.isIntersecting) {
						tg.lastState = v.isIntersecting;
						setTimeout(() => tg.callback(v.isIntersecting), 10);
					}
				}
			}
		}, observingOption);

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
		if (viewType == "links") {
			setIcon(iconDivEl, "links-coming-in");
			incomingIcon = iconDivEl.innerHTML;
			setIcon(iconDivEl, "links-going-out");
			outgoingIcon = iconDivEl.innerHTML;
			setIcon(iconDivEl, "link");
			linkIcon = iconDivEl.innerHTML;
		}
		setIcon(iconDivEl, "lucide-arrow-left-right");
		switchIcon = iconDivEl.innerHTML;
		const int = setInterval(() => {
			performHide.set(Date.now());
		}, 5000);
		return () => {
			clearInterval(int);
		};
	});
	onDestroy(() => {
		observer.disconnect();
	});
	$: headerTitle =
		title == ""
			? `${viewType == "tags" ? "Tags" : "Links"}: ${vaultName}`
			: `Items: ${title}`;
	let viewItems = [] as ViewItem[];
	$: {
		if (viewItemsSrc) {
			if (isMainTree) {
				viewItems = viewItemsSrc;
			} else {
				let items = viewItemsSrc;
				const lowerTags = tags.map((e) => e.toLowerCase());
				for (const tag of lowerTags) {
					items = items.filter((e) =>
						e.tags.some((e) =>
							(e.toLowerCase() + "/").startsWith(tag),
						),
					);
				}

				const firstLevel = trimTrailingSlash(
					tags.first() ?? "",
				).toLowerCase();

				// Processing archive tags
				const archiveTags = _setting.archiveTags
					.toLowerCase()
					.replace(/[\n ]/g, "")
					.split(",");

				if (!archiveTags.contains(firstLevel)) {
					items = items.filter(
						(item) =>
							!item.tags.some((e) =>
								archiveTags.contains(e.toLowerCase()),
							),
					);
				}
				viewItems = items;
			}
		}
	}
	$: isMainTree = tags.length == 0;
	let scrollParent: HTMLDivElement;

	const componentHash = `${Math.random()}`;
	setContext("viewID", componentHash);
</script>

<div hidden bind:this={iconDivEl} />
<div class="nav-header">
	<div class="nav-buttons-container tagfolder-buttons-container">
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="clickable-icon nav-action-button"
			aria-label="New note"
			on:click={newNote}
		>
			{@html newNoteIcon}
		</div>
		{#if isMainTree}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="clickable-icon nav-action-button"
				aria-label="Change sort order"
				on:click={showOrder}
			>
				{@html upAndDownArrowsIcon}
			</div>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="clickable-icon nav-action-button"
				aria-label="Expand limit"
				on:click={showLevelSelect}
			>
				{@html stackedLevels}
			</div>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
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
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="clickable-icon nav-action-button"
				aria-label="Switch List/Tree"
				on:click={doSwitch}
			>
				{@html switchIcon}
			</div>
		{/if}
		{#if viewType == "links"}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="clickable-icon nav-action-button"
				class:is-active={incomingEnabled}
				aria-label="Toggle Incoming"
				on:click={switchIncoming}
			>
				{@html incomingIcon}
			</div>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="clickable-icon nav-action-button"
				class:is-active={outgoingEnabled}
				aria-label="Toggle Outgoing"
				on:click={switchOutgoing}
			>
				{@html outgoingIcon}
			</div>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="clickable-icon nav-action-button"
				class:is-active={onlyFDREnabled}
				aria-label="Toggle Hide indirect notes"
				on:click={switchOnlyFDR}
			>
				{@html linkIcon}
			</div>
		{/if}
	</div>
</div>
{#if showSearch && isMainTree}
	<div class="search-row">
		<div class="search-input-container global-search-input-container">
			<input
				type="search"
				spellcheck="false"
				placeholder="Type to start search..."
				bind:value={search}
			/>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="search-input-clear-button"
				aria-label="Clear search"
				style="display:{search.trim() == '' ? 'none' : ''};"
				on:click={clearSearch}
			/>
		</div>
	</div>
{/if}
<div class="nav-files-container node-insert-event" bind:this={scrollParent}>
	<V2TreeFolderComponent
		{viewType}
		items={viewItems}
		{folderIcon}
		thisName={""}
		isRoot={true}
		{showMenu}
		{openFile}
		{isMainTree}
		{hoverPreview}
		{openScrollView}
		depth={1}
		{headerTitle}
	/>
</div>

<style>
	.nav-files-container {
		height: 100%;
	}
</style>
