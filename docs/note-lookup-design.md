# Note lookup design

Status: implemented; pending release.

This document specifies the command-palette workflow for opening a note by incrementally adding and removing tag conditions.

## Commands

- `Open note by tags` opens an empty lookup dialogue.
- `Open note with similar tags` starts with the active Markdown note's tags selected and excludes that note from the results.

Both commands open the same dialogue. If the active note has no tags, the similar-note command opens with an empty tag selection. The similar-note command is unavailable when there is no active Markdown note.

## Layout

```text
Note lookup

Tags
[#foo ×] [#bar ×] [-#archive ×] [type a tag…]

┌ Tag completions (popover while typing)
│ ▸ #project/client                         24 notes
│   #project/personal                       11 notes
└

Note
[type a file name or path…]

────────────────────────────────────────────────────────
▸ filename.md  path/to/                         2/2
  Alternative title                    #foo #bar

  another-note.md  other/                      1/2
                                             #foo
```

Selected tags are displayed as removable chips. Positive tags use the normal tag treatment; excluded tags use a visually distinct treatment and retain the leading minus sign. Tag completions appear as a popover over the content only while the tag input is focused and contains text, so they do not reduce the result list's height.

On phone-sized viewports, the selected-tag field is limited to approximately two compact chip rows or 15% of the available viewport height, whichever is smaller. This gives the note results priority. Additional chips can still scroll vertically inside the field for removal, rather than pushing the note field and results off screen. Long tag labels are truncated with an ellipsis, and the field does not scroll horizontally. The field uses Obsidian's compact radius while individual tags retain the standard pill shape.

The implementation uses Obsidian's `multi-select-pill`, `suggestion-container`, `suggestion-item`, and `is-selected` structures. Theme-owned variables define pill colours, borders, radii, suggestion selection, and mobile spacing. Plug-in CSS is limited to the two-field layout, compact result details, and the dashed excluded-tag state.

Each compact note row places the file name and parent path on its first line, followed by the positive-tag match count. An alternative title and the matching tags use a smaller second line when present. On narrow mobile viewports, matching tags are omitted from the row so that the file name, path, and more results remain visible. The result list takes all remaining dialogue height and scrolls independently.

The active note uses Obsidian's standard suggestion selection background. File details and the match count are vertically centred within each row, and the count keeps a fixed area at the right edge. When horizontal space is limited, the parent path shrinks first, then an overlong file name is truncated with an ellipsis without overlapping the match count or creating horizontal scrolling.

The result list is not a third focus target. It has an active row, shown by the `▸` marker above, while DOM focus remains in one of the two inputs.

On iPhone, the dialogue uses Obsidian's phone dialogue width, maximum height, and safe-area variables. This keeps the title and standard Close control below the status area while preserving Obsidian's normal mobile touch target.

## Focus model

The dialogue opens with DOM focus in the tag input for both commands. The similar-note command preselects its highest-ranked result, so `Enter` can open that result immediately even though the preloaded tags remain editable.

`Tab` and `Shift+Tab` switch between the tag input and the note input. They do not commit a partially typed tag. When focus leaves the tag input, its completion list closes, but its uncommitted text remains. Returning to the tag input restores the relevant completions.

The two inputs form a small focus cycle:

```text
Tag input  -- Tab -->  Note input
Tag input <-- Shift+Tab -- Note input
```

Clicking either input also moves focus directly to it. Clicking a note opens it, and clicking a chip's remove control removes that condition.

## Keyboard interaction

### Global keys

| Key | Behaviour |
| --- | --- |
| `Tab` | Move between the tag and note inputs. |
| `Shift+Tab` | Move between the inputs in the reverse direction. |
| `Escape` | Leave chip-selection mode first; otherwise, close the dialogue. |

### Tag input with text

| Key | Behaviour |
| --- | --- |
| Character input | Update the tag completions. `fo` and `#fo` search positive tags; `-fo` and `-#fo` search excluded tags. |
| `ArrowUp` / `ArrowDown` | Change the active tag completion. |
| `Space` / `Enter` | Add the active completion as a chip, clear the text, and keep focus in the tag input. |
| `Backspace` / `Delete` | Edit the uncommitted text normally. |
| `Tab` | Move to the note input without committing the text. |

Only existing tags can be committed. Selected tags are omitted from later completion lists. Prefix matches are ranked before other matches, then by the number of notes containing the tag.

### Empty tag input

| Key | Behaviour |
| --- | --- |
| `ArrowUp` / `ArrowDown` | Change the active note result without moving DOM focus. |
| `Enter` | Open the active note. |
| `Ctrl+Enter` / `Cmd+Enter` | Open the active note in a new tab. |
| `Backspace` | Remove the last selected tag. |
| `ArrowLeft` | Enter chip-selection mode at the last selected tag. |
| Character input | Start a new tag completion query. |

### Chip-selection mode

Chip selection is an internal active state. DOM focus remains in the tag input, so removing a condition does not interrupt typing.

| Key | Behaviour |
| --- | --- |
| `ArrowLeft` / `ArrowRight` | Move between selected tag chips. Moving right beyond the last chip returns to the tag input. |
| `Backspace` / `Delete` | Remove the active chip and keep the nearest remaining chip active. If no chip remains, return to the tag input. |
| `Escape` | Cancel chip selection and return to the tag input. |
| Character input | Cancel chip selection and start a new tag completion query. |

Chips are not added to the `Tab` sequence. This keeps switching to the note input predictable even when the similar-note command preloads many tags.

### Note input

| Key | Behaviour |
| --- | --- |
| Character input | Fuzzily filter note titles and Vault-relative paths. |
| `ArrowUp` / `ArrowDown` | Change the active note result without moving DOM focus. |
| `Enter` | Open the active note. |
| `Ctrl+Enter` / `Cmd+Enter` | Open the active note in a new tab. |
| `Shift+Tab` | Return to the tag input. |

## Result behaviour

Positive tags use OR semantics. A note remains in the results when it matches at least one selected positive tag. Results are primarily ordered by the number of distinct positive conditions they match. The note query then filters and ranks the remaining results fuzzily, with modification time and path providing stable tie-breaks.

An excluded tag is a hard exclusion rather than a scoring penalty. A note that matches `-#archive` does not remain in the result list. This preserves the meaning of subtraction used by the existing TagFolder search. A separate syntax should be introduced later if soft demotion is needed.

Tag matching is case-insensitive and respects nested-tag boundaries. For example, `#project` matches `#project/client`, but does not match `#projectile`.

With no positive tags, all otherwise eligible notes are available. Excluded tags and the note query still apply. With neither tag nor note input, recent notes provide the initial deterministic ordering.

## Accessibility and input methods

Tag completions and note results use `listbox`, `option`, and `aria-activedescendant` semantics. The inputs retain DOM focus while the active option changes. An `aria-live` region announces tag additions and tag removals.

Keyboard handlers must ignore `Enter` and `Space` while `KeyboardEvent.isComposing` is true. An IME confirmation or conversion must not add a tag or open a note.

The focused input, active completion, active chip, positive tags, excluded tags, and active note must remain visually distinguishable without relying on colour alone.
