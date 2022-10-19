<script lang="ts">
	import { MarkdownRenderer } from "obsidian";

	import { onDestroy, onMount } from "svelte";
	import { ScrollViewFile } from "types";

	export let file: ScrollViewFile = { path: "" };
	export let observer: IntersectionObserver;

	let el: HTMLElement;

	function onAppearing(this: HTMLElement, ev: Event) {
		if (file.content && el) {
			MarkdownRenderer.renderMarkdown(file.content, el, file.path, null);
		}
	}

	onMount(() => {
		observer.observe(el);
		el.addEventListener("appearing", onAppearing);
	});
	onDestroy(() => {
		observer.unobserve(el);
		el.removeEventListener("appearing", onAppearing);
	});

	$: {
		if (file && file.content && el) {
			el.innerHTML = "";
			MarkdownRenderer.renderMarkdown(file.content, el, file.path, null);
		}
	}
</script>

<div class="markdownBody" bind:this={el} />

<style>
	.markdownBody {
		user-select: text;
		-webkit-user-select: text;
	}
</style>
