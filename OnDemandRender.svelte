<script lang="ts">
	import { performHide } from "store";
	import { getContext, onMount } from "svelte";
	export let cssClass = "";
	export let isVisible = false;
	let hidingScheduled = false;
	let observer: IntersectionObserver;

	const { getScrollParent } = getContext("tf-list") as {
		getScrollParent: () => HTMLDivElement;
	};
	const scrollParent = getScrollParent();
	const observingOption = {
		root: scrollParent,
		rootMargin: "40px 0px",
		threshold: 0,
	};
	function setIsVisible(visibility: boolean) {
		if (isVisible != visibility) {
			if (visibility) {
				isVisible = visibility;
			}
		}
		hidingScheduled = !visibility;
	}
	function startObserving() {
		observer = new IntersectionObserver((ex) => {
			if (ex.some((e) => e.isIntersecting)) {
				// Just a trick
				setTimeout(() => {
					setIsVisible(true);
				}, 10);
			} else {
				setIsVisible(false);
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
		startObserving();
		performHide.subscribe(() => {
			if (hidingScheduled) {
				isVisible = false;
				hidingScheduled = false;
			}
		});
		return () => {
			stopObserving();
		};
	});

	let _el: HTMLDivElement;
	let el: HTMLDivElement;

	$: {
		if (observer) {
			if (_el != el) {
				if (_el) {
					observer.unobserve(_el);
				}
				_el = el;
				observer.observe(el);
			}
		}
	}
</script>

<div class={cssClass} bind:this={el}>
	<slot {isVisible} />
</div>
