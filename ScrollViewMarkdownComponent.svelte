<script lang="ts">
	import { MarkdownRenderer } from "obsidian";

	import { onDestroy, onMount } from "svelte";
	import { type ScrollViewFile } from "types";

	export let file: ScrollViewFile = { path: "" };
	export let observer: IntersectionObserver;

	let el: HTMLElement;
	let renderedContent = "";

	function onAppearing(this: HTMLElement, _: Event) {
		if (file.content && el && renderedContent != file.content) {
			MarkdownRenderer.renderMarkdown(file.content, el, file.path, null);
			renderedContent = file.content;
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
		if (
			renderedContent &&
			file &&
			file.content &&
			el &&
			renderedContent != file.content
		) {
			el.style.minHeight = `${el.clientHeight}px`;
			el.innerHTML = "";
			MarkdownRenderer.renderMarkdown(file.content, el, file.path, null);
			renderedContent = file.content;
			el.style.minHeight = "20px";
		}
	}
</script>

<div class="markdownBody" bind:this={el} style="min-height: 1em;" />

<style>
	.markdownBody {
		user-select: text;
		-webkit-user-select: text;
	}
</style>
