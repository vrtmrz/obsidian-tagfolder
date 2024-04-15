import { App, SuggestModal } from "obsidian";

export const askString = (app: App, title: string, placeholder: string, initialText: string): Promise<string | false> => {
    return new Promise((res) => {
        const popover = new PopoverSelectString(app, title, placeholder, initialText, (result) => res(result));
        popover.open();
    });
};

export class PopoverSelectString extends SuggestModal<string> {
    app: App;
    callback?: (e: string | false) => void = () => { };
    title = "";

    getSuggestions(query: string): string[] | Promise<string[]> {
        return [query];
    }
    renderSuggestion(value: string, el: HTMLElement) {
        el.createDiv({ text: `${this.title}${value}` });
    }
    onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
        this.callback?.(item);
        this.callback = undefined;
    }

    constructor(app: App, title: string, placeholder: string | null, initialText: string, callback: (e: string | false) => void) {
        super(app);
        this.app = app;
        this.title = title;
        this.setPlaceholder(placeholder ?? ">");
        this.callback = callback;

        setTimeout(() => {
            this.inputEl.value = initialText;
            // this.inputEl.onchange();
        })
        const parent = this.containerEl.querySelector(".prompt");
        if (parent) {
            parent.addClass("override-input");
        }
    }
    onClose(): void {
        setTimeout(() => {
            if (this.callback) {
                this.callback(false);
            }
        }, 100);
    }
}