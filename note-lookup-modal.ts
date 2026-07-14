import { Modal, type App } from "obsidian";
import { mount, unmount } from "svelte";
import NoteLookupModalComponent from "./NoteLookupModal.svelte";
import type { LookupTagCondition, NoteLookupItem } from "./note-lookup";

export interface OpenNoteLookupOptions {
	readonly notes: readonly NoteLookupItem[];
	readonly initialConditions?: readonly LookupTagCondition[];
	readonly excludedPath?: string;
	readonly openNote: (path: string, newTab: boolean) => void;
}

export class NoteLookupModal extends Modal {
	private component?: ReturnType<typeof mount>;

	constructor(app: App, private readonly options: OpenNoteLookupOptions) {
		super(app);
	}

	onOpen() {
		this.setTitle("Note lookup");
		this.modalEl.addClass("tagfolder-note-lookup-modal");
		this.contentEl.empty();
		this.component = mount(NoteLookupModalComponent, {
			target: this.contentEl,
			props: {
				notes: this.options.notes,
				initialConditions: this.options.initialConditions,
				excludedPath: this.options.excludedPath,
				openNote: (path: string, newTab: boolean) => {
					this.options.openNote(path, newTab);
					this.close();
				},
				close: () => this.close(),
			},
		});
	}

	onClose() {
		if (this.component) {
			void unmount(this.component);
			this.component = undefined;
		}
		this.contentEl.empty();
	}
}

export function openNoteLookup(app: App, options: OpenNoteLookupOptions) {
	new NoteLookupModal(app, options).open();
}
