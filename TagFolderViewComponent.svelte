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
		type TagFolderListState,
	} from "./types";
	import V2TreeFolderComponent from "./V2TreeFolderComponent.svelte";
	import { onDestroy, onMount, tick } from "svelte";
	import { setIcon } from "obsidian";
	import { trimTrailingSlash } from "./util";
	import { setContext } from "svelte";
	import type { Writable } from "svelte/store";

	interface Props {
		hoverPreview: (e: MouseEvent, path: string) => void;
		openFile: (path: string, specialKey: boolean) => void;
		vaultName?: string;
		title?: string;
		tags?: string[];
		saveSettings: (setting: TagFolderSettings) => Promise<void>;
		showMenu: (
			evt: MouseEvent,
			trail: string[],
			targetTag?: string,
			targetItems?: ViewItem[],
		) => void;
		showLevelSelect: (evt: MouseEvent) => void;
		showOrder: (evt: MouseEvent) => void;
		newNote: (evt: MouseEvent) => void;
		openScrollView: (
			leaf: undefined,
			title: string,
			tagPath: string,
			files: string[],
		) => Promise<void>;
		isViewSwitchable: boolean;
		switchView: () => void;
		viewType?: TREE_TYPE;
		stateStore?: Writable<TagFolderListState>;
	}

	let {
		hoverPreview,
		openFile,
		vaultName = "",
		title = $bindable<string>(""),
		tags = $bindable<string[]>([]),
		saveSettings,
		showMenu,
		showLevelSelect,
		showOrder,
		newNote,
		openScrollView,
		isViewSwitchable,
		switchView,
		viewType = "tags",
		stateStore,
	}: Props = $props();

	const isMainTree = $derived(tags.length == 0);

	stateStore?.subscribe((state) => {
		tags = state.tags;
		title = state.title;
	});
	// let viewItemsSrc = $state([] as ViewItem[]);

	let updatedFiles = $state([] as string[]);
	appliedFiles.subscribe(async (filenames) => {
		updatedFiles = filenames ?? [];
	});

	const viewItemsSrc = $derived.by(() => {
		if (viewType == "tags") return $allViewItems;
		return $allViewItemsByLink;
	});

	let _setting = $state($tagFolderSetting as TagFolderSettings);
	let outgoingEnabled = $state(false);
	let incomingEnabled = $state(false);
	let bothEnabled = $state(false);
	let onlyFDREnabled = $state(false);
	tagFolderSetting.subscribe((setting) => {
		_setting = setting;
		const incoming = _setting.linkConfig?.incoming?.enabled ?? false;
		const outgoing = _setting.linkConfig?.outgoing?.enabled ?? false;
		if (!incoming && !outgoing) {
			let newSet = { ..._setting };
			newSet.linkConfig.incoming.enabled = true;
			newSet.linkConfig.outgoing.enabled = true;
			if (saveSettings) saveSettings(newSet);
			bothEnabled = true;
		} else {
			outgoingEnabled = !incoming && outgoing;
			incomingEnabled = incoming && !outgoing;
			bothEnabled = incoming && outgoing;
		}
		onlyFDREnabled = _setting.linkShowOnlyFDR;
	});
	let showSearch = $state(false);
	function toggleSearch() {
		showSearch = !showSearch;
		if (!showSearch) {
			$searchString = "";
		}
	}
	function clearSearch() {
		$searchString = "";
	}

	function doSwitch() {
		if (switchView) {
			switchView();
		}
	}
	let iconDivEl = $state<HTMLDivElement>();
	let newNoteIcon = $state("");
	let folderIcon = $state("");
	let upAndDownArrowsIcon = $state("");
	let stackedLevels = $state("");
	let searchIcon = $state("");
	let switchIcon = $state("");
	let outgoingIcon = $state("");
	let incomingIcon = $state("");
	let bothIcon = $state("");
	let linkIcon = $state("");

	async function switchIncoming() {
		let newSet = { ..._setting };
		newSet.linkConfig.incoming.enabled = true;
		newSet.linkConfig.outgoing.enabled = false;
		if (saveSettings) await saveSettings(newSet);
	}
	async function switchOutgoing() {
		let newSet = { ..._setting };
		newSet.linkConfig.incoming.enabled = false;
		newSet.linkConfig.outgoing.enabled = true;

		if (saveSettings) await saveSettings(newSet);
	}
	async function switchBoth() {
		let newSet = { ..._setting };
		newSet.linkConfig.incoming.enabled = true;
		newSet.linkConfig.outgoing.enabled = true;
		if (saveSettings) await saveSettings(newSet);
	}
	async function switchOnlyFDR() {
		let newSet = { ..._setting };
		newSet.linkShowOnlyFDR = !_setting.linkShowOnlyFDR;
		if (saveSettings) await saveSettings(newSet);
	}

	let observer: IntersectionObserver | undefined;

	type handler = {
		callback: (visibility: boolean) => void;
		lastState: boolean | undefined;
	};

	let observingElements = new Map<Element, handler>();
	let scrollParent: HTMLDivElement | undefined;
	let observingElQueue = [] as Element[];

	function observe(el: Element, callback: (visibility: boolean) => void) {
		if (!observer) {
			observingElQueue.push(el);
		} else {
			if (observingElQueue.length > 0) {
				observeAllQueued();
			}
		}
		if (observingElements.has(el)) {
			unobserve(el);
			observingElements.delete(el);
		}
		observingElements.set(el, { callback, lastState: undefined });
		observer?.observe(el);
	}
	function unobserve(el: Element) {
		observer?.unobserve(el);
	}

	function observeAllQueued() {
		observingElQueue.forEach((el) => {
			observer?.observe(el);
		});
		observingElQueue = [];
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
		observeAllQueued();
		if (iconDivEl) {
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
				setIcon(iconDivEl, "lucide-link-2");
				bothIcon = iconDivEl.innerHTML;
			}
			setIcon(iconDivEl, "lucide-arrow-left-right");
			switchIcon = iconDivEl.innerHTML;
		}
		const int = setInterval(() => {
			performHide.set(Date.now());
		}, 5000);

		return () => {
			clearInterval(int);
		};
	});
	onDestroy(() => {
		observer?.disconnect();
	});
	let headerTitle = $derived(
		title == ""
			? `${viewType == "tags" ? "Tags" : "Links"}: ${vaultName}`
			: `Items: ${title}`,
	);
	const viewItems = $derived.by(() => {
		if (!viewItemsSrc) {
			return [];
		}
		if (isMainTree) {
			return viewItemsSrc;
		}

		let items = viewItemsSrc;
		const lowerTags = tags.map((e) => e.toLowerCase());
		for (const tag of lowerTags) {
			items = items.filter((e) =>
				e.tags.some((e) => (e.toLowerCase() + "/").startsWith(tag)),
			);
		}

		const firstLevel = trimTrailingSlash(tags.first() ?? "").toLowerCase();

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
		return items;
	});

	const componentHash = `${Math.random()}`;
	setContext("viewID", componentHash);
</script>

<div hidden bind:this={iconDivEl}></div>
<div class="nav-header">
	<div class="nav-buttons-container tagfolder-buttons-container">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="clickable-icon nav-action-button"
			aria-label="New note"
			onclick={newNote}
		>
			{@html newNoteIcon}
		</div>
		{#if isMainTree}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="clickable-icon nav-action-button"
				aria-label="Change sort order"
				onclick={showOrder}
			>
				{@html upAndDownArrowsIcon}
			</div>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="clickable-icon nav-action-button"
				aria-label="Expand limit"
				onclick={showLevelSelect}
			>
				{@html stackedLevels}
			</div>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class={`clickable-icon nav-action-button ${showSearch ? " is-active" : ""}`}
				aria-label="Search"
				onclick={toggleSearch}
			>
				{@html searchIcon}
			</div>
		{/if}
		{#if isViewSwitchable}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="clickable-icon nav-action-button"
				aria-label="Switch List/Tree"
				onclick={doSwitch}
			>
				{@html switchIcon}
			</div>
		{/if}
		{#if viewType == "links"}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="clickable-icon nav-action-button"
				class:is-active={incomingEnabled}
				aria-label="Toggle Incoming"
				onclick={switchIncoming}
			>
				{@html incomingIcon}
			</div>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="clickable-icon nav-action-button"
				class:is-active={outgoingEnabled}
				aria-label="Toggle Outgoing"
				onclick={switchOutgoing}
			>
				{@html outgoingIcon}
			</div>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="clickable-icon nav-action-button"
				class:is-active={bothEnabled}
				aria-label="Toggle Incoming&Outgoing"
				onclick={switchBoth}
			>
				{@html bothIcon}
			</div>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="clickable-icon nav-action-button"
				class:is-active={onlyFDREnabled}
				aria-label="Toggle Hide indirect notes"
				onclick={switchOnlyFDR}
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
				bind:value={$searchString}
			/>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="search-input-clear-button"
				aria-label="Clear search"
				style="display:{$searchString.trim() == '' ? 'none' : ''};"
				onclick={clearSearch}
			></div>
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
