<script lang="ts">
	import { getContext, onMount, afterUpdate } from "svelte";

	export let placeHolderClass = "";
	export let wrapperClass = "";
	export let force = false;

	let isVisible = force;
	let observer: IntersectionObserver;

	const { getScrollParent } = getContext("tf-list") as {
		getScrollParent: () => HTMLDivElement;
	};
	const scrollParent = getScrollParent();
	const observingOption = {
		root: scrollParent,
		rootMargin: "80px 0px",
		threshold: 0,
	};
	function startObserving() {
		if (observer) {
			return;
		}
		observer = new IntersectionObserver((ex) => {
			if (ex.some((e) => e.isIntersecting)) {
				isVisible = true;
			} else {
				isVisible = force;
			}
		}, observingOption);
	}
	function stopObserving() {
		if (observer) {
			observer.disconnect();
			observer = undefined;
		}
	}
	onMount(() => {
		if (el) {
			el.addEventListener("toggled", handleToggled);
		}
		startObserving();
		return () => {
			stopObserving();
			if (el) {
				el.removeEventListener("toggled", handleToggled);
			}
		};
	});

	let _el: HTMLDivElement;
	let el: HTMLDivElement;

	$: {
		if (observer) {
			if (_el != el) {
				if (_el) {
					observer.unobserve(_el);
					_el.removeEventListener("toggled", handleToggled);
				}
				_el = el;
				observer.observe(el);
				_el.addEventListener("toggled", handleToggled);
			}
		}
	}
	$: {
		if (force) {
			stopObserving();
		} else {
			startObserving();
		}
	}
	let ch = 0;
	function measureHeight(force?: boolean) {
		if (isVisible || force) {
			const { height } = el.getBoundingClientRect();
			if (ch != height) {
				ch = height;
				el.dispatchEvent(new CustomEvent("toggled", { bubbles: true }));
			}
		}
	}
	function handleToggled(evt: Event) {
		if (evt.target != el) {
			measureHeight(true);
		}
	}
	afterUpdate(async () => {
		measureHeight();
	});
	$: stylePlaceHolder = !isVisible && ch ? `height:${ch}px;` : ``;
	$: cssClass = wrapperClass + (isVisible ? "" : " " + placeHolderClass);
</script>

<div class={cssClass} style={stylePlaceHolder} bind:this={el}>
	{#if isVisible}
		<slot />
	{:else}
		<div>...</div>
	{/if}
</div>
