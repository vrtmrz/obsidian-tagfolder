<script lang="ts">
	import { writable, type Writable } from "svelte/store";

	import { type ScrollViewFile, type ScrollViewState } from "types";
	import { renderSpecialTag, trimTrailingSlash } from "./util";

	import ScrollViewMarkdown from "ScrollViewMarkdownComponent.svelte";
	import { onDestroy } from "svelte";
	import type TagFolderPlugin from "main";

	interface Props {
		store?: Writable<ScrollViewState>;
		openfile: (path: string, specialKey: boolean) => void;
		plugin: TagFolderPlugin;
	}

	let {
		store = writable<ScrollViewState>({
			files: [],
			title: "",
			tagPath: "",
		}),
		openfile,
		plugin,
	}: Props = $props();

	const _state: ScrollViewState = $derived($store);
	let files = $derived(_state.files);
	const tagPath = $derived(
		_state.tagPath
			.split(", ")
			.map(
				(e) =>
					"#" +
					trimTrailingSlash(e)
						.split("/")
						.map((e) => renderSpecialTag(e.trim()))
						.join("/"),
			)
			.join(", "),
	);
	function handleOpenFile(e: MouseEvent, file: ScrollViewFile) {
		openfile(file.path, false);
		e.preventDefault();
	}
	// Observe appearing and notify the component that you should render the content.
	let scrollEl = $state<HTMLElement>();
	let observer = $state<IntersectionObserver>();
	const onAppearing = new CustomEvent("appearing", {
		detail: {},
	});
	$effect(() => {
		const options = {
			root: scrollEl,
			rootMargin: "10px",
			threshold: 0,
		};
		observer = new IntersectionObserver(
			(entries: IntersectionObserverEntry[]) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.dispatchEvent(onAppearing);
					}
				}
			},
			options,
		);
	});
	onDestroy(() => {
		observer?.disconnect();
	});
</script>

<div class="x">
	<div class="header">
		Files with {tagPath}
	</div>
	<hr />
	{#each files as file}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="file"
			onclick={(evt) => handleOpenFile(evt, file)}
			bind:this={scrollEl}
		>
			<div class="header">
				<span>{file.title}</span>
				<span class="path">({file.path})</span>
			</div>
			<ScrollViewMarkdown {file} {observer} {plugin} />
			<hr />
		</div>
	{/each}
</div>

<style>
	.header {
		background-color: var(--background-secondary-alt);
		position: sticky;
		top: 0;
		color: var(--text-normal);
		margin-bottom: 8px;
	}
	.file {
		cursor: pointer;
	}
	.path {
		font-size: 75%;
	}
	hr {
		margin: 8px auto;
	}
</style>
