import { ItemView, Menu, Notice, TFile } from "obsidian";
import TagFolderViewComponent from "./TagFolderViewComponent.svelte";
import TagFolderPlugin from "./main";
import {
    OrderDirection,
    OrderKeyItem,
    OrderKeyTag,
    TagFolderItem,
    VIEW_TYPE_TAGFOLDER,
    VIEW_TYPE_TAGFOLDER_LIST
} from "./types";
import { maxDepth, selectedTags } from "./store";
import { ancestorToLongestTag, ancestorToTags, isSpecialTag, omittedTags, renderSpecialTag } from "./util";
export abstract class TagFolderViewBase extends ItemView {
    component: TagFolderViewComponent;
    plugin: TagFolderPlugin;

    showOrder(evt: MouseEvent) {
        const menu = new Menu();

        menu.addItem((item) => {
            item.setTitle("Tags")
                .setIcon("hashtag")
                .onClick(async (evt2) => {
                    const menu2 = new Menu();
                    for (const key in OrderKeyTag) {
                        for (const direction in OrderDirection) {
                            menu2.addItem((item) => {
                                const newSetting = `${key}_${direction}`;
                                item.setTitle(
                                    OrderKeyTag[key] +
                                    " " +
                                    OrderDirection[direction]
                                ).onClick(async () => {
                                    //@ts-ignore
                                    this.plugin.settings.sortTypeTag =
                                        newSetting;
                                    await this.plugin.saveSettings();
                                    this.plugin.setRoot(this.plugin.root);
                                });
                                if (
                                    newSetting ==
                                    this.plugin.settings.sortTypeTag
                                ) {
                                    item.setIcon("checkmark");
                                }

                                menu2.showAtMouseEvent(evt);
                                return item;
                            });
                        }
                    }
                });
            return item;
        });
        menu.addItem((item) => {
            item.setTitle("Items")
                .setIcon("document")
                .onClick(async (evt2) => {
                    const menu2 = new Menu();
                    for (const key in OrderKeyItem) {
                        for (const direction in OrderDirection) {
                            menu2.addItem((item) => {
                                const newSetting = `${key}_${direction}`;
                                item.setTitle(
                                    OrderKeyItem[key] +
                                    " " +
                                    OrderDirection[direction]
                                ).onClick(async () => {
                                    //@ts-ignore
                                    this.plugin.settings.sortType = newSetting;
                                    await this.plugin.saveSettings();
                                    this.plugin.setRoot(this.plugin.root);
                                });
                                if (
                                    newSetting == this.plugin.settings.sortType
                                ) {
                                    item.setIcon("checkmark");
                                }

                                menu2.showAtMouseEvent(evt);
                                return item;
                            });
                        }
                    }
                });
            return item;
        });
        menu.showAtMouseEvent(evt);
    }

    showLevelSelect(evt: MouseEvent) {
        const menu = new Menu();
        const setLevel = async (level: number) => {
            this.plugin.settings.expandLimit = level;
            await this.plugin.saveSettings();
            maxDepth.set(level);
            this.plugin.setRoot(this.plugin.root);
        };
        for (const level of [2, 3, 4, 5]) {
            menu.addItem((item) => {
                item.setTitle(`Level ${level - 1}`).onClick(() => {
                    setLevel(level);
                });
                if (this.plugin.settings.expandLimit == level)
                    item.setIcon("checkmark");
                return item;
            });
        }

        menu.addItem((item) => {
            item.setTitle("No limit")
                // .setIcon("hashtag")
                .onClick(() => {
                    setLevel(0);
                });
            if (this.plugin.settings.expandLimit == 0)
                item.setIcon("checkmark");

            return item;
        });
        menu.showAtMouseEvent(evt);
    }

    abstract getViewType(): string;

    showMenu(evt: MouseEvent, path: string, entry: TagFolderItem) {

        const entryPath = "tag" in entry ? [...ancestorToTags(entry.ancestors)] : ['root', ...entry.tags];

        if ("tag" in entry) {
            const oTags = omittedTags(entry, this.plugin.settings);
            if (oTags != false) {
                entryPath.push(...oTags);
            }
        }
        entryPath.shift()
        const expandedTagsAll = ancestorToLongestTag(ancestorToTags(entryPath));
        const expandedTags = expandedTagsAll
            .map(e => e.split("/")
                .filter(ee => !isSpecialTag(ee))
                .join("/")).filter(e => e != "")
            .map((e) => "#" + e)
            .join(" ")
            .trim();
        const displayExpandedTags = expandedTagsAll
            .map(e => e.split("/")
                .filter(ee => renderSpecialTag(ee))
                .join("/")).filter(e => e != "")
            .map((e) => "#" + e)
            .join(" ")
            .trim();
        const menu = new Menu();

        if (navigator && navigator.clipboard) {
            menu.addItem((item) =>
                item
                    .setTitle(`Copy tags:${expandedTags}`)
                    .setIcon("hashtag")
                    .onClick(async () => {
                        await navigator.clipboard.writeText(expandedTags);
                        new Notice("Copied");
                    })
            );
        }
        menu.addItem((item) =>
            item
                .setTitle(`New note ${"tag" in entry ? "in here" : "as like this"}`)
                .setIcon("create-new")
                .onClick(async () => {
                    //@ts-ignore
                    const ww = await this.app.fileManager.createAndOpenMarkdownFile() as TFile;
                    await this.app.vault.append(ww, expandedTags);
                })
        );
        if ("tag" in entry) {
            if (this.plugin.settings.useTagInfo && this.plugin.tagInfo != null) {
                const tag = entry.ancestors[entry.ancestors.length - 1];

                if (tag in this.plugin.tagInfo && this.plugin.tagInfo[tag]) {
                    menu.addItem((item) =>
                        item.setTitle(`Unpin`)
                            .setIcon("pin")
                            .onClick(async () => {
                                this.plugin.tagInfo =
                                {
                                    ...this.plugin.tagInfo,
                                    [tag]: undefined
                                };
                                this.plugin.applyTagInfo();
                                await this.plugin.saveTagInfo();
                            })
                    )

                } else {
                    menu.addItem((item) => {
                        item.setTitle(`Pin`)
                            .setIcon("pin")
                            .onClick(async () => {
                                this.plugin.tagInfo =
                                {
                                    ...this.plugin.tagInfo,
                                    [tag]: { key: "" }
                                };
                                this.plugin.applyTagInfo();
                                await this.plugin.saveTagInfo();
                            })
                    })
                }
                menu.addItem(item => {
                    item.setTitle(`Open scroll view`)
                        .setIcon("sheets-in-box")
                        .onClick(async () => {
                            const files = entry.allDescendants.map(e => e.path);
                            const tagPath = entry.ancestors.join("/");
                            await this.plugin.openScrollView(null, displayExpandedTags, tagPath, files);
                        })
                })
                menu.addItem(item => {
                    item.setTitle(`Open list`)
                        .setIcon("sheets-in-box")
                        .onClick(async () => {
                            selectedTags.set(
                                entry.ancestors
                            );
                        })
                })
            }
        }
        if ("path" in entry) {
            const path = entry.path;
            const file = this.app.vault.getAbstractFileByPath(path);
            // Trigger
            this.app.workspace.trigger(
                "file-menu",
                menu,
                file,
                "file-explorer"
            );
        }

        if ("tags" in entry) {
            menu.addSeparator();
            menu.addItem((item) =>
                item
                    .setTitle(`Open in new tab`)
                    .setIcon("lucide-file-plus")
                    .onClick(async () => {
                        app.workspace.openLinkText(entry.path, entry.path, "tab");
                    })
            );
            menu.addItem((item) =>
                item
                    .setTitle(`Open to the right`)
                    .setIcon("lucide-separator-vertical")
                    .onClick(async () => {
                        app.workspace.openLinkText(entry.path, entry.path, "split");
                    })
            );
        }
        if ("screenX" in evt) {
            menu.showAtPosition({ x: evt.pageX, y: evt.pageY });
        } else {
            menu.showAtPosition({
                // @ts-ignore
                x: evt.nativeEvent.locationX,
                // @ts-ignore
                y: evt.nativeEvent.locationY,
            });
        }
        // menu.showAtMouseEvent(evt);
    }

    switchView() {
        const viewType = this.getViewType() == VIEW_TYPE_TAGFOLDER ? VIEW_TYPE_TAGFOLDER_LIST : VIEW_TYPE_TAGFOLDER;
        const leaves = this.app.workspace.getLeavesOfType(viewType).filter(e => !e.getViewState().pinned && e != this.leaf);
        if (leaves.length) {
            this.app.workspace.revealLeaf(
                leaves[0]
            );
        }
    }
}
