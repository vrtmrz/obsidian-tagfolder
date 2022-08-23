<script lang="ts">
	import { MarkdownRenderer } from "obsidian";

	import { onMount } from "svelte";
	import { ScrollViewFile } from "types";

	export let file: ScrollViewFile = { path: "" };
	let el: HTMLDivElement;

	onMount(() => {
		if (file.content && el) {
			MarkdownRenderer.renderMarkdown(file.content, el, file.path, null);
		}
	});

	$: {
		if (file && file.content && el) {
			el.innerHTML = "";
			MarkdownRenderer.renderMarkdown(file.content, el, file.path, null);
		}
	}
</script>

<div class="markdownBody" bind:this={el}>
</div>

<style>
	.markdownBody {
		user-select: text;
		-webkit-user-select: text;
	}
</style>
