<script lang="ts">
	import { performHide } from "store";
	import { getContext, onDestroy, onMount } from "svelte";
	export let cssClass = "";
	export let isVisible = false;
	let hidingScheduled = false;

	const { observe, unobserve } = getContext("observer") as {
		observe: (el: Element, callback: (visibility: boolean) => void) => void;
		unobserve: (el: Element) => void;
	};
	function setIsVisible(visibility: boolean) {
		if (isVisible != visibility) {
			if (visibility) {
				isVisible = visibility;
			}
		}
		hidingScheduled = !visibility;
	}

	onMount(() => {
		performHide.subscribe(() => {
			if (hidingScheduled) {
				isVisible = false;
				hidingScheduled = false;
			}
		});
	});
	onDestroy(() => {
		if (_el) {
			unobserve(_el);
		}
	});

	let _el: HTMLDivElement;
	let el: HTMLDivElement;

	$: {
		if (_el != el) {
			if (_el) {
				unobserve(_el);
			}
			_el = el;
			if (el) {
				observe(el, setIsVisible);
			}
		}
	}
</script>

<div class={cssClass} bind:this={el}>
	<slot {isVisible} />
</div>
