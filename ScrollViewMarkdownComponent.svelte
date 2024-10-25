<script lang="ts">
	import type TagFolderPlugin from "main";
	import { MarkdownRenderer } from "obsidian";

	import { onDestroy, onMount } from "svelte";
	import { type ScrollViewFile } from "types";

	interface Props {
		file?: ScrollViewFile;
		observer?: IntersectionObserver;
		plugin: TagFolderPlugin;
	}

	let { file = { path: "" }, observer, plugin }: Props = $props();

	let el = $state<HTMLElement>();
	let renderedContent = $state("");

	function onAppearing(this: HTMLElement, _: Event) {
		if (file.content && el && renderedContent != file.content) {
			MarkdownRenderer.render(
				plugin.app,
				file.content,
				el,
				file.path,
				plugin,
			);
			renderedContent = file.content;
		}
	}

	onMount(() => {
		if (el && observer) {
			observer.observe(el);
			el.addEventListener("appearing", onAppearing);
		}
	});
	onDestroy(() => {
		if (el && observer) {
			observer.unobserve(el);
			el.removeEventListener("appearing", onAppearing);
		}
	});

	$effect(() => {
		if (
			renderedContent &&
			file &&
			file.content &&
			el &&
			renderedContent != file.content
		) {
			el.style.minHeight = `${el.clientHeight}px`;
			el.innerHTML = "";
			MarkdownRenderer.render(
				plugin.app,
				file.content,
				el,
				file.path,
				plugin,
			);
			renderedContent = file.content;
			el.style.minHeight = "20px";
		}
	});
</script>

<div class="markdownBody" bind:this={el} style="min-height: 1em;"></div>

<style>
	.markdownBody {
		user-select: text;
		-webkit-user-select: text;
	}
</style>
