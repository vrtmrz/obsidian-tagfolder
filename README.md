## MyTagFolder

This is my custom build of the Obsidian TagFolder plugin.

Original project: https://github.com/vrtmrz/obsidian-tagfolder

My fork keeps the original plugin behavior and adds my changes on top of it.

### What I changed

- Added support for creating new notes from a configured template when using TagFolder.
- When no template is selected, new notes are created with TagFolder's default behavior. If `Store tags in frontmatter for new notes` is enabled, those fallback notes store their tags in Properties/frontmatter; otherwise the tags are inserted as hashtags.
- Added a TagFolder context-menu action for renaming tags through TagWrangler.

### Install my build

Download the ready-to-install zip from the GitHub Release:

https://github.com/boabab/obsidian-tagfolder/releases/download/mytagfolder-v0.18.13-20260430/mytagfolder-plugin.zip

Unzip it into this folder in your Obsidian vault:

```text
<your-vault>/.obsidian/plugins/obsidian-tagfolder/
```

The folder should contain:

```text
main.js
manifest.json
styles.css
```

Restart Obsidian, then open Settings -> Community plugins and enable `MyTagFolder`.

### Source branch

The branch with both custom features is:

https://github.com/boabab/obsidian-tagfolder/tree/feature/all-my-features
