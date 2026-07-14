<script lang="ts">
	import { onMount, untrack } from "svelte";
	import {
		getTagCompletions,
		rankNoteLookupItems,
		tagMatchesCondition,
		type LookupTagCondition,
		type NoteLookupItem,
		type RankedNoteLookupItem,
		type TagCompletion,
	} from "./note-lookup";

	interface Props {
		notes: readonly NoteLookupItem[];
		initialConditions?: readonly LookupTagCondition[];
		excludedPath?: string;
		openNote: (path: string, newTab: boolean) => void;
		close: () => void;
	}

	let {
		notes,
		initialConditions = [],
		excludedPath,
		openNote,
		close,
	}: Props = $props();

	const MAX_COMPLETIONS = 12;
	const MAX_RESULTS = 100;
	let conditions = $state<LookupTagCondition[]>(
		untrack(() => initialConditions.map((condition) => ({ ...condition }))),
	);
	let tagQuery = $state("");
	let noteQuery = $state("");
	let activeCompletionIndex = $state(0);
	let activeNoteIndex = $state(0);
	let activeChipIndex = $state(-1);
	let tagInputFocused = $state(false);
	let announcement = $state("");
	let tagInputEl = $state<HTMLInputElement>();
	let noteInputEl = $state<HTMLInputElement>();

	const completions = $derived(
		getTagCompletions(notes, conditions, tagQuery).slice(0, MAX_COMPLETIONS),
	);
	const rankedNotes = $derived(
		rankNoteLookupItems(notes, conditions, noteQuery, { excludedPath }),
	);
	const visibleNotes = $derived(rankedNotes.slice(0, MAX_RESULTS));
	const positiveConditionCount = $derived(
		conditions.filter((condition) => !condition.excluded).length,
	);
	const showCompletions = $derived(tagInputFocused && tagQuery.trim() != "" && completions.length > 0);
	const tagActiveDescendant = $derived.by(() => {
		if (activeChipIndex >= 0) return `tagfolder-note-lookup-chip-${activeChipIndex}`;
		if (showCompletions) return `tagfolder-note-lookup-completion-${activeCompletionIndex}`;
		if (visibleNotes.length > 0) return `tagfolder-note-lookup-note-${activeNoteIndex}`;
		return undefined;
	});
	const noteActiveDescendant = $derived(
		visibleNotes.length > 0 ? `tagfolder-note-lookup-note-${activeNoteIndex}` : undefined,
	);

	$effect(() => {
		if (activeCompletionIndex >= completions.length) activeCompletionIndex = Math.max(0, completions.length - 1);
	});
	$effect(() => {
		if (activeNoteIndex >= visibleNotes.length) activeNoteIndex = Math.max(0, visibleNotes.length - 1);
	});
	$effect(() => {
		if (activeChipIndex >= conditions.length) activeChipIndex = conditions.length - 1;
	});

	onMount(() => {
		tagInputEl?.focus();
	});

	$effect(() => {
		const index = activeNoteIndex;
		if (visibleNotes.length == 0) return;
		tagInputEl?.win.requestAnimationFrame(() => {
			tagInputEl?.ownerDocument
				.getElementById(`tagfolder-note-lookup-note-${index}`)
				?.scrollIntoView({ block: "nearest" });
		});
	});

	$effect(() => {
		const index = activeCompletionIndex;
		if (!showCompletions) return;
		tagInputEl?.win.requestAnimationFrame(() => {
			tagInputEl?.ownerDocument
				.getElementById(`tagfolder-note-lookup-completion-${index}`)
				?.scrollIntoView({ block: "nearest" });
		});
	});

	function moveIndex(current: number, length: number, delta: number) {
		if (length == 0) return 0;
		return (current + delta + length) % length;
	}

	function focusOtherInput(current: "tag" | "note") {
		activeChipIndex = -1;
		if (current == "tag") {
			noteInputEl?.focus();
		} else {
			tagInputEl?.focus();
		}
	}

	function addCompletion(completion: TagCompletion) {
		conditions = [...conditions, { tag: completion.tag, excluded: completion.excluded }];
		tagQuery = "";
		activeCompletionIndex = 0;
		activeNoteIndex = 0;
		activeChipIndex = -1;
		announcement = `${completion.excluded ? "Excluded" : "Added"} tag ${completion.tag}`;
		tagInputEl?.focus();
	}

	function removeCondition(index: number) {
		const removed = conditions[index];
		if (!removed) return;
		conditions = conditions.filter((_, conditionIndex) => conditionIndex != index);
		activeNoteIndex = 0;
		if (conditions.length == 0) {
			activeChipIndex = -1;
		} else if (activeChipIndex >= 0) {
			activeChipIndex = Math.min(index, conditions.length - 1);
		}
		announcement = `Removed tag ${removed.tag}`;
		tagInputEl?.focus();
	}

	function chooseActiveNote(newTab: boolean) {
		const item = visibleNotes[activeNoteIndex];
		if (!item) return;
		openNote(item.path, newTab);
	}

	function displayTags(item: RankedNoteLookupItem) {
		const positive = conditions.filter((condition) => !condition.excluded);
		const tags = positive.length == 0
			? [...item.tags]
			: item.tags.filter((tag) => positive.some((condition) => tagMatchesCondition(tag, condition.tag)));
		return tags.slice(0, 5);
	}

	function noteFileName(item: RankedNoteLookupItem) {
		return item.path.split("/").pop() ?? item.path;
	}

	function noteParentPath(item: RankedNoteLookupItem) {
		const separator = item.path.lastIndexOf("/");
		return separator < 0 ? "" : item.path.substring(0, separator + 1);
	}

	function hasAlternativeTitle(item: RankedNoteLookupItem) {
		return item.title != noteFileName(item).replace(/\.md$/i, "");
	}

	function handleCommonKey(event: KeyboardEvent, current: "tag" | "note") {
		if (event.key == "Tab") {
			event.preventDefault();
			focusOtherInput(current);
			return true;
		}
		if (event.key == "Escape") {
			event.preventDefault();
			if (activeChipIndex >= 0) {
				activeChipIndex = -1;
				tagInputEl?.focus();
			} else {
				close();
			}
			return true;
		}
		return false;
	}

	function handleTagKey(event: KeyboardEvent) {
		if (event.isComposing) return;
		if (handleCommonKey(event, "tag")) return;

		if (activeChipIndex >= 0) {
			if (event.key == "ArrowLeft" || event.key == "ArrowRight") {
				event.preventDefault();
				const delta = event.key == "ArrowLeft" ? -1 : 1;
				const next = activeChipIndex + delta;
				if (next >= conditions.length) {
					activeChipIndex = -1;
				} else {
					activeChipIndex = Math.max(0, next);
				}
				return;
			}
			if (event.key == "Backspace" || event.key == "Delete") {
				event.preventDefault();
				removeCondition(activeChipIndex);
				return;
			}
			if (event.key.length == 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
				activeChipIndex = -1;
			}
		}

		if (tagQuery != "") {
			if (event.key == "ArrowUp" || event.key == "ArrowDown") {
				event.preventDefault();
				activeCompletionIndex = moveIndex(
					activeCompletionIndex,
					completions.length,
					event.key == "ArrowUp" ? -1 : 1,
				);
				return;
			}
			if (event.key == "Enter" || event.key == " ") {
				event.preventDefault();
				const completion = completions[activeCompletionIndex];
				if (completion) addCompletion(completion);
			}
			return;
		}

		if (event.key == "ArrowLeft" && conditions.length > 0) {
			event.preventDefault();
			activeChipIndex = conditions.length - 1;
			return;
		}
		if (event.key == "Backspace" && conditions.length > 0) {
			event.preventDefault();
			removeCondition(conditions.length - 1);
			return;
		}
		if (event.key == "ArrowUp" || event.key == "ArrowDown") {
			event.preventDefault();
			activeNoteIndex = moveIndex(
				activeNoteIndex,
				visibleNotes.length,
				event.key == "ArrowUp" ? -1 : 1,
			);
			return;
		}
		if (event.key == "Enter") {
			event.preventDefault();
			chooseActiveNote(event.ctrlKey || event.metaKey);
			return;
		}
		if (event.key == " ") {
			event.preventDefault();
		}
	}

	function handleNoteKey(event: KeyboardEvent) {
		if (event.isComposing) return;
		if (handleCommonKey(event, "note")) return;
		if (event.key == "ArrowUp" || event.key == "ArrowDown") {
			event.preventDefault();
			activeNoteIndex = moveIndex(
				activeNoteIndex,
				visibleNotes.length,
				event.key == "ArrowUp" ? -1 : 1,
			);
			return;
		}
		if (event.key == "Enter") {
			event.preventDefault();
			chooseActiveNote(event.ctrlKey || event.metaKey);
		}
	}
</script>

<div class="note-lookup">
	<div class="tag-field">
		<label for="tagfolder-note-lookup-tag-input">Tags</label>
		<div class="tag-input-shell">
			<div class="tag-chips" id="tagfolder-note-lookup-selected-tags">
				{#each conditions as condition, index (`${condition.excluded ? "-" : "+"}${condition.tag}`)}
					<button
						type="button"
						id={`tagfolder-note-lookup-chip-${index}`}
						class:excluded={condition.excluded}
						class:active={activeChipIndex == index}
						class="tag-chip multi-select-pill"
						tabindex="-1"
						aria-label={`Remove ${condition.excluded ? "excluded " : ""}tag ${condition.tag}`}
						onclick={() => removeCondition(index)}
					>
						<span class="multi-select-pill-content">{condition.excluded ? "- " : ""}#{condition.tag}</span>
						<span class="multi-select-pill-remove-button" aria-hidden="true">×</span>
					</button>
				{/each}
				<input
					id="tagfolder-note-lookup-tag-input"
					bind:this={tagInputEl}
					bind:value={tagQuery}
					type="text"
					role="combobox"
					spellcheck="false"
					autocomplete="off"
					placeholder={conditions.length == 0 ? "Type a tag…" : "Add a tag…"}
					aria-label="Tag conditions"
					aria-controls="tagfolder-note-lookup-completions tagfolder-note-lookup-notes tagfolder-note-lookup-selected-tags"
					aria-expanded={showCompletions}
					aria-activedescendant={tagActiveDescendant}
					oninput={() => {
						activeCompletionIndex = 0;
						activeChipIndex = -1;
					}}
					onfocus={() => tagInputFocused = true}
					onblur={() => tagInputFocused = false}
					onkeydown={handleTagKey}
				/>
			</div>
		</div>

		{#if showCompletions}
			<div class="completions suggestion-container">
				<div class="suggestion" id="tagfolder-note-lookup-completions" role="listbox" aria-label="Tag completions">
					{#each completions as completion, index (completion.tag)}
						<button
							type="button"
							id={`tagfolder-note-lookup-completion-${index}`}
							class:is-selected={activeCompletionIndex == index}
							class="completion suggestion-item mod-complex"
							role="option"
							aria-selected={activeCompletionIndex == index}
							tabindex="-1"
							onmousedown={(event) => event.preventDefault()}
							onmouseenter={() => activeCompletionIndex = index}
							onclick={() => addCompletion(completion)}
						>
							<span>{completion.excluded ? "-" : ""}#{completion.tag}</span>
							<span class="count">{completion.noteCount} {completion.noteCount == 1 ? "note" : "notes"}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<label for="tagfolder-note-lookup-note-input">Note</label>
	<input
		id="tagfolder-note-lookup-note-input"
		bind:this={noteInputEl}
		bind:value={noteQuery}
		class="note-input"
		type="text"
		role="combobox"
		spellcheck="false"
		autocomplete="off"
		placeholder="Type a file name or path…"
		aria-label="Note name or path"
		aria-controls="tagfolder-note-lookup-notes"
		aria-expanded="true"
		aria-activedescendant={noteActiveDescendant}
		oninput={() => activeNoteIndex = 0}
		onkeydown={handleNoteKey}
	/>

	<div class="result-summary" aria-hidden="true">
		<span>{rankedNotes.length} {rankedNotes.length == 1 ? "note" : "notes"}</span>
		<span>Tab: switch field · ↑↓: select · Enter: open</span>
	</div>

	<div class="notes prompt-results" id="tagfolder-note-lookup-notes" role="listbox" aria-label="Matching notes">
		{#each visibleNotes as item, index (item.path)}
			<button
				type="button"
				id={`tagfolder-note-lookup-note-${index}`}
				class:is-selected={activeNoteIndex == index}
				class="note-result suggestion-item mod-complex search-suggest-item"
				role="option"
				aria-selected={activeNoteIndex == index}
				tabindex="-1"
				onmousedown={(event) => event.preventDefault()}
				onmouseenter={() => activeNoteIndex = index}
				onclick={(event) => openNote(item.path, event.ctrlKey || event.metaKey)}
			>
				<div class="suggestion-content">
					<span class="note-location">
						<span class="note-file-name">{noteFileName(item)}</span>
						{#if noteParentPath(item)}
							<span class="note-parent-path">{noteParentPath(item)}</span>
						{/if}
					</span>
					<div class="note-detail-row">
						{#if hasAlternativeTitle(item)}
							<span class="note-alternative-title">{item.title}</span>
						{/if}
						<span class="note-tags">
							{#each displayTags(item) as tag}
								<span>#{tag}</span>
							{/each}
						</span>
					</div>
				</div>
				{#if positiveConditionCount > 0}
					<span class="suggestion-aux match-count">{item.matchCount}/{positiveConditionCount}</span>
				{/if}
			</button>
		{/each}
		{#if visibleNotes.length == 0}
			<div class="empty-result">No matching notes</div>
		{/if}
	</div>

	<div class="sr-only" aria-live="polite">{announcement}</div>
</div>

<style>
	.note-lookup {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		flex: 1;
		width: 100%;
		min-width: 0;
		min-height: 0;
	}
	:global(.tagfolder-note-lookup-modal) {
		width: min(46rem, 90vw);
		max-width: 90vw;
		height: min(46rem, calc(100dvh - 2rem));
		max-height: calc(100dvh - 2rem);
	}
	:global(.tagfolder-note-lookup-modal .modal-content) {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	label {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
		font-weight: var(--font-semibold);
	}
	.tag-input-shell,
	.note-input {
		background: var(--background-modifier-form-field);
		border: var(--input-border-width) solid var(--background-modifier-border);
		border-radius: var(--input-radius);
		box-shadow: var(--input-shadow);
	}
	.tag-input-shell {
		width: 100%;
		max-width: 100%;
		min-width: 0;
		overflow: hidden;
		border-radius: var(--radius-s);
	}
	.tag-input-shell:focus-within,
	.note-input:focus {
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
	}
	.tag-field {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		z-index: 2;
	}
	.tag-chips {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.3rem;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		min-height: 2.25rem;
		padding: 0.3rem 0.45rem;
	}
	.tag-chips input {
		flex: 1 1 9rem;
		min-width: 7rem;
		border: 0;
		box-shadow: none;
		background: transparent;
		padding: 0.2rem;
	}
	.tag-chips input:focus {
		border: 0;
		box-shadow: none;
	}
	.tag-chip {
		--pill-color: var(--tag-color);
		--pill-color-hover: var(--tag-color-hover);
		--pill-color-remove: var(--tag-color);
		--pill-color-remove-hover: var(--tag-color-hover);
		--pill-decoration: var(--tag-decoration);
		--pill-decoration-hover: var(--tag-decoration-hover);
		--pill-background: var(--tag-background);
		--pill-background-hover: var(--tag-background-hover);
		--pill-border-color: var(--tag-border-color);
		--pill-border-color-hover: var(--tag-border-color-hover);
		--pill-border-width: var(--tag-border-width);
		--pill-padding-x: var(--tag-padding-x);
		--pill-padding-y: var(--tag-padding-y);
		--pill-radius: var(--tag-radius);
		--pill-corner-shape: var(--tag-corner-shape);
		--pill-weight: var(--tag-weight);
		font-size: var(--tag-size);
		min-width: 0;
		max-width: 100%;
		height: auto;
		box-shadow: none;
	}
	.tag-chip .multi-select-pill-content {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tag-chip.excluded {
		--pill-color: var(--text-error);
		--pill-color-hover: var(--text-error);
		--pill-color-remove: var(--text-error);
		--pill-color-remove-hover: var(--text-error);
		--pill-background: transparent;
		--pill-background-hover: var(--background-modifier-hover);
		--pill-border-color: var(--text-error);
		--pill-border-color-hover: var(--text-error);
		--pill-border-width: var(--border-width);
		border-style: dashed;
	}
	.tag-chip.active::after {
		content: "";
		display: block;
		position: absolute;
		pointer-events: none;
		border-radius: var(--pill-radius);
		inset: 0;
		box-shadow: 0 0 0 1px var(--background-modifier-border-focus), inset 0 0 0 1px var(--background-modifier-border-focus);
	}
	.completions {
		top: calc(100% + 0.25rem);
		left: 0;
		right: 0;
		max-width: none;
		max-height: 14rem;
	}
	.completions .suggestion {
		overflow-y: auto;
		padding: var(--size-2-3);
	}
	.completion,
	.note-result {
		width: 100%;
		border: 0;
		background: transparent;
		box-shadow: none;
		color: var(--text-normal);
		text-align: left;
	}
	.completion {
		display: flex;
		justify-content: space-between;
	}
	.completion.is-selected,
	.note-result.is-selected {
		background-color: var(--background-modifier-hover);
	}
	.count,
	.result-summary,
	.match-count {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}
	.note-input {
		width: 100%;
		padding: 0.55rem 0.7rem;
	}
	.result-summary {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.notes {
		flex: 1;
		min-height: 5rem;
		overflow-y: auto;
		border-top: 1px solid var(--background-modifier-border);
		padding: var(--size-2-3) 0 0;
	}
	.note-result {
		align-items: center;
		padding: var(--size-2-2) var(--size-4-2);
	}
	.note-result .suggestion-content {
		flex: 1 1 auto;
		min-width: 0;
		width: auto;
		overflow: hidden;
	}
	.note-detail-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		min-width: 0;
	}
	.note-result .suggestion-aux {
		flex: 0 0 auto;
		align-self: center;
	}
	.note-location {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		width: 100%;
		min-width: 0;
		overflow: hidden;
	}
	.note-file-name {
		flex: 0 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--font-ui-small);
		font-weight: var(--font-semibold);
	}
	.note-parent-path,
	.note-alternative-title {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}
	.note-parent-path,
	.note-alternative-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.note-parent-path {
		flex: 0 10 auto;
		min-width: 0;
		max-width: 40%;
	}
	.match-count {
		white-space: nowrap;
	}
	.note-alternative-title {
		min-width: 0;
	}
	.note-tags {
		display: flex;
		gap: 0.4rem;
		flex-shrink: 0;
		color: var(--text-accent);
		font-size: var(--font-ui-smaller);
	}
	.empty-result {
		padding: 2rem;
		text-align: center;
		color: var(--text-muted);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	@media (max-width: 600px) {
		:global(.tagfolder-note-lookup-modal) {
			width: calc(100vw - 0.75rem);
			max-width: calc(100vw - 0.75rem);
			height: calc(100dvh - 0.75rem);
			max-height: calc(100dvh - 0.75rem);
		}
		:global(body.is-phone .tagfolder-note-lookup-modal) {
			width: var(--dialog-width);
			max-width: var(--dialog-max-width);
			height: 100%;
			max-height: var(--dialog-max-height);
			margin-top: auto;
		}
		.note-lookup,
		.tag-field {
			gap: 0.3rem;
		}
		.tag-chips {
			padding: 0.2rem 0.3rem;
			max-height: min(calc(var(--input-height) * 1.5), 15dvh);
			overflow-x: hidden;
			overflow-y: auto;
			align-content: flex-start;
		}
		.note-input {
			padding: 0.4rem 0.55rem;
		}
		.note-result {
			padding: var(--size-2-2) var(--size-4-2);
		}
		.note-location {
			gap: 0.35rem;
		}
		.result-summary span:last-child,
		.note-tags {
			display: none;
		}
	}
</style>
