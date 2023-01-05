<script lang="ts">
	import { writable, Writable } from "svelte/store";

	import { ScrollViewFile, ScrollViewState } from "types";
	import { renderSpecialTag } from "./util";

	import ScrollViewMarkdown from "ScrollViewMarkdownComponent.svelte";
	import { onDestroy, onMount } from "svelte";

	export let store: Writable<ScrollViewState> = writable<ScrollViewState>({
		files: [],
		title: "",
		tagPath: "",
	});
	export let openfile: (path: string, specialKey: boolean) => void;
	let state: ScrollViewState = { files: [], title: "", tagPath: "" };

	$: {
		store.subscribe((_state) => {
			state = { ..._state };
			return () => {};
		});
	}
	$: files = state.files;
	$: tagPath = state.tagPath
		.split("/")
		.map((e) => renderSpecialTag(e))
		.join("/");
	function handleOpenFile(e: MouseEvent, file: ScrollViewFile) {
		openfile(file.path, false);
		e.preventDefault();
	}
	// Observe appearing and notify the component that you should render the content.
	let scrollEl: HTMLElement;
	let observer: IntersectionObserver;
	const onAppearing = new CustomEvent("appearing", {
		detail: {},
	});
	onMount(() => {
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
			options
		);
	});
	onDestroy(() => {
		observer.disconnect();
	});
</script>

<div class="x">
	<div class="header">
		Files in {tagPath}
	</div>
	<hr />
	{#each files as file}
		<div
			class="file"
			on:click={(evt) => handleOpenFile(evt, file)}
			bind:this={scrollEl}
		>
			<div class="header">
				<span>{file.title}</span>
				<span class="path">({file.path})</span>
			</div>
			<ScrollViewMarkdown {file} {observer} />
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
