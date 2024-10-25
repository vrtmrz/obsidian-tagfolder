<script lang="ts">
    import OnDemandRender from "OnDemandRender.svelte";

    import type { TREE_TYPE, TagFolderSettings, ViewItem } from "types";
    import {
        renderSpecialTag,
        trimSlash,
        escapeStringToHTML,
        getExtraTags,
        uniqueCaseIntensive,
    } from "./util";
    import { currentFile, pluginInstance, tagFolderSetting } from "./store";

    const viewType: TREE_TYPE = "tags";

    interface Props {
        // Display props
        item: ViewItem;
        trail: string[];
        // Callbacks
        openFile: (path: string, specialKey: boolean) => void;
        showMenu: (
        evt: MouseEvent,
        trail: string[],
        targetTag?: string,
        targetItems?: ViewItem[],
    ) => void;
        hoverPreview: (e: MouseEvent, path: string) => void;
    }

    let {
        item,
        trail,
        openFile,
        showMenu,
        hoverPreview
    }: Props = $props();

    // Event handlers
    function handleMouseover(e: MouseEvent, path: string) {
        hoverPreview(e, path);
    }

    const _setting = $derived($tagFolderSetting as TagFolderSettings);
    const _currentActiveFilePath = $derived($currentFile);

    // To highlighting
    let isActive = $derived(item.path == _currentActiveFilePath);

    // Compute extra tags. (Only on visible)
    let isItemVisible = $state(false);
    const tagsLeft = $derived(isItemVisible? uniqueCaseIntensive(
                getExtraTags(item.tags, [...trail], _setting.reduceNestedParent)
                    .map((e) => trimSlash(e, false, true))
                    .filter((e) => e != ""),
            ):[]);
    const extraTagsHtml = $derived(`${tagsLeft
                .map(
                    (e) =>
                        `<span class="tf-tag">${escapeStringToHTML(
                            renderSpecialTag(e),
                        )}</span>`,
                )
                .join("")}`);

    const draggable = $derived(!_setting.disableDragging);
    const app = $derived($pluginInstance?.app);
    //@ts-ignore internal API
    const dm = $derived(app?.dragManager);

    function dragStartFile(args: DragEvent) {
        if (!draggable) return;
        const file = app.vault.getAbstractFileByPath(item.path);
        const param = dm.dragFile(args, file);
        if (param) {
            return dm.onDragStart(args, param);
        }
    }
</script>

<OnDemandRender
    cssClass="tree-item nav-file"
    bind:isVisible={isItemVisible}
>
    {#snippet children({ isVisible })}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="tree-item-self is-clickable nav-file-title"
            class:is-active={isActive}
            {draggable}
            data-path={item.path}
            ondragstart={dragStartFile}
            onclick={(evt) => openFile(item.path, evt.metaKey || evt.ctrlKey)}
            onmouseover={(e) => {
                handleMouseover(e, item.path);
            }}
            onfocus={() => {
                /* ignore aria complaint */
            }}
            oncontextmenu={(evt) => showMenu(evt, trail, undefined, [item])}
        >
            <div class="tree-item-inner nav-file-title-content lsl-f">
                {isVisible ? item.displayName : ""}
            </div>
            {#if isVisible}
                <div class="tf-taglist">{@html extraTagsHtml}</div>
            {/if}
        </div>
    {/snippet}
</OnDemandRender>
