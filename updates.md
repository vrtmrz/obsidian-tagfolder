## Unreleased

### New features

-   Nested tags can be excluded or archived as a group with `*` patterns (PR #138). Exact entries keep their previous meaning; use `tag,tag/*` to include a parent and its descendants. Thank you @boabab for the contribution.
-   Note lookup and similar-note lookup apply the same ignored-note and ignored-tag patterns as the tag tree.
-   Added a Simplified Chinese interface and a `Language` setting (PR #162).
-   Added `Tag grouping` item ordering, using the written tag sequence to keep each branch and its descendants together (PR #163).

### Improved

-   Sort names and tags using the Obsidian interface language with natural numeric ordering, independently of the TagFolder display language. Use English when the application language cannot be read, including on Obsidian versions before 1.8.7.
-   Fall back to English for untranslated interfaces, including Traditional Chinese, and preserve user-defined tag labels.

### Digging the weeds

-   Added regression coverage for wildcard archive routing, exact matching, and note lookup filtering.
-   Updated development dependencies to address dependency audit findings.
-   Kept the dependency lockfile compatible with npm 10 clean installations, and pinned CI installation to npm 10.
-   Added Community Review checks for source code, and used Obsidian's DOM helpers for tag-tree previews.

## 0.18.22

15th September, 2026

### Improved

-   Added a sort order button to the file list pane, with sorting options available directly in the menu (PR #161). Thank you @DDDDZJQ for the contribution.

### Digging the weeds

-   Added regression tests for the file list sort button and menu, and for the existing tag and link tree controls.

## 0.18.21

14th August, 2026

### New features

-   Added `Simple list`, `Drill-down`, and `Full tree` suggestions to make the tag-tree structure easier to configure (PR #158).
-   Each suggestion includes a compact example and applies only the related tag-tree settings, leaving every resulting setting individually editable.

### Digging the weeds

-   Added real-Obsidian coverage for applying a suggested style and for the desktop and mobile preview layouts.

## 0.18.20

11th August, 2026

### Improved

-   When clicking a tag in a note to filter TagFolder, the applied tag is now shown immediately in the search field, so the filter can be cleared with one click. Thank you @boabab for the contribution.

### Digging the weeds

-   Updated the real-Obsidian mobile layout coverage to use the shared assertions from the test-session package.

## 0.18.19

14th July, 2026

I have finally implemented a feature I have wanted for a very long time. I hope you will all enjoy it too.

### New features

-   Added `Open note by tags`, which opens a keyboard-friendly dialogue for finding and opening notes by tag.
-   Search incrementally with tag completion. Press `Space` or `Enter` to add a tag, remove selected tags without leaving the keyboard, and prefix a tag with `-` to exclude matching notes.
-   Positive tags use OR matching, so a note only needs one selected tag to remain visible. Notes matching more selected tags appear first, with the match count shown beside each result.
-   Filter the remaining notes by typing part of a file name or Vault-relative path in the separate note field.
-   Added `Open note with similar tags`, which starts with the active note's tags selected and omits the active note itself from the results.

### Fixes

-   Kept the note lookup dialogue's title and Close control below the iPhone status area.
-   Limited the selected-tag field on phones to two rows, with additional tags scrolling inside the field, so that the note filter and results receive more space.
-   Used a compact corner radius for the selected-tag field while retaining Obsidian's standard pill treatment for individual tags.
-   Truncated long tag labels and prevented the selected-tag field from scrolling horizontally on narrow screens.

## 0.18.19-beta.2

14th July, 2026

I have finally implemented a feature I have wanted for a very long time. I hope you will all enjoy it too.

### Fixes

-   Fixed the note lookup dialogue on iPhone so that its title and Close control remain below the status area.
-   Limited the selected-tag field on phones to two rows, with additional tags scrolling inside the field, so that the note filter and results receive more space.
-   Reduced the selected-tag field's corner radius on phones while retaining Obsidian's standard pill treatment for individual tags.
-   Truncated long tag labels and prevented the selected-tag field from scrolling horizontally on narrow screens.

## 0.18.19-beta.1

14th July, 2026

I have finally implemented a feature I have wanted for a very long time. I hope you will all enjoy it too.

### New features

-   Added `Open note by tags`, which opens a keyboard-friendly dialogue for finding and opening notes by tag.
-   Search incrementally with tag completion. Press `Space` or `Enter` to add a tag, remove selected tags without leaving the keyboard, and prefix a tag with `-` to exclude matching notes.
-   Positive tags use OR matching, so a note only needs one selected tag to remain visible. Notes matching more selected tags appear first, with the match count shown beside each result.
-   Filter the remaining notes by typing part of a file name or Vault-relative path in the separate note field.
-   Added `Open note with similar tags`, which starts with the active note's tags selected and omits the active note itself from the results.
-   The lookup dialogue follows the active Obsidian theme and remains usable on narrow mobile screens, including when the software keyboard reduces the available height.

## 0.18.18

### Digging the weeds

-   Refactored new-note frontmatter updates through the shared Fancy Kit Vault capability without changing the visible workflow.
-   Added App-free frontmatter transcript and failure tests, and extended the local real-Obsidian scenario to verify persisted frontmatter tags.

## 0.18.17

### Improved

-   Improved new-note template selection so that suggestions show both the template name and its Vault-relative path.
-   Template suggestions in the settings tab are now captured when the tab opens, avoiding repeated Vault enumeration and sorting while typing.
-   The new-note template selection dialogue captures a fresh template list each time it opens, without installing a Vault watcher.
-   When no templates are available, TagFolder now asks for the action to be retried after a template has been added, instead of creating a note without the requested template.

### Digging the weeds

-   Refactored UI interactions and Vault text operations into explicit Fancy Kit capabilities.
-   Added App-free workflow tests and a local real-Obsidian scenario for template selection and persisted note content.

## 0.18.16

### Fixes

-   Fixed nested tag collection when rendering a subtree with a previous trail, so relative child tags are matched against their full tag path correctly.
-   Fixed archive tag filtering at the root tree so descendant archive branches remain visible while archived notes are hidden from unrelated root folders.

### Digging the weeds

-   Added CI for pull requests and pushes to `main`.
-   Added automated tests for TagFolder template rendering, tag tree collection, archive filtering, and utility functions.
-   Added coverage reporting for the new test suite.

## ~~0.18.12~~ 0.18.13

(0.18.12 was skipped due to a versioning mistake)

### Fixes

-   Support the click-to-search function in the attribute list (#98, #128)
    -   Thank you for your contribution, @sunzhi0000-sys!

### Improved

-   Dependencies are updated to the latest version.
-   Small minor improvements have been made.

## 0.18.11

Since 0.18.11, I have written this changelog as same as the Self-hosted LiveSync. It is quite useful for us.

### Fixes

-   Now `Disable narrowing down` works correctly again (#114).

### New features

-   Redirecting tags are applied to virtual tags (#110)
-   Collapse all expanded tags are implemented (#112)

### Digging the weeds

-   Many dependencies are updated to the latest version. And also the Svelte compiler is updated to the latest version.
-   Now `npm run check` implemented in the package.json. Runs tsc, eslint, svelte-check at once.
