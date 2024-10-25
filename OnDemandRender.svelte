<script lang="ts">
    import { performHide } from "store";
    import { getContext, onDestroy, onMount } from "svelte";
    interface Props {
        cssClass?: string;
        isVisible?: boolean;
        children?: import('svelte').Snippet<[any]>;
    }

    let { cssClass = "", isVisible = $bindable(false), children }: Props = $props();
    let hidingScheduled = $state(false);

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

    let _el = $state<HTMLDivElement>();
    let el = $state<HTMLDivElement>();

    $effect(() => {
        if (_el != el) {
            if (_el) {
                unobserve(_el);
            }
            _el = el;
            if (el) {
                observe(el, setIsVisible);
            }
        }
    });
</script>

<div class={cssClass} bind:this={el}>
    {@render children?.({ isVisible, })}
</div>
