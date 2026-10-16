# Real Obsidian E2E

This local-only suite installs the built TagFolder plug-in into an isolated vault and profile through `@vrtmrz/obsidian-test-session`. It is not part of the default CI gate.

The new-note scenario selects a seeded template through the real Obsidian picker, verifies its secondary path description, creates a note through TagFolder, and checks the resulting Vault content. The note-lookup scenario drives the real TagFolder commands and Svelte dialogue, adds positive and excluded tags through the keyboard, changes field focus, opens the selected note, and verifies similar-note initialisation. At a fixed phone viewport, it also uses the public test-session layout assertions to check the title and Close control against supplied safe-area insets, require a 44 CSS-pixel Close touch target, prevent horizontal overflow in the tag field, and keep the note field inside the viewport. TagFolder retains its plug-in-specific checks for tag wrapping, field shape, and the space reserved for note results. The tag-tree-style scenario selects a suggestion in the real settings tab, checks its sample preview, applies it, and verifies that the plug-in rebuilds its view items with the suggested structure. None of the scenarios use scripted UI or Vault responses.

The locale-and-tag-order scenario changes Obsidian's real language setting between Japanese, Simplified Chinese, and Traditional Chinese. It checks automatic translation fallback and explicit English and Simplified Chinese preferences, verifies that changing the plug-in interface language preserves application-language ordering, and checks saved preferences after a renderer reload. Its real Vault fixtures cover written tag branches, parent prefixes, numeric tags, frontmatter tags, and ignored virtual tags. It checks ordering inside the left tag tree and in a separated list opened by clicking a tag, and asserts that the default separated list belongs to the left sidebar. An explicitly selected `Current pane` list provides additional coverage of the other placement. Screenshots and a JSON report are written to `_testdata/e2e-obsidian/locale-tag-order`; set `E2E_OBSIDIAN_LOCALE_ORDER_ARTIFACT_DIR` to choose another directory. A failed scenario also saves a screenshot and report.

The tag-filter scenario changes and saves filter settings through the real settings tab, checks wildcard archive routing in the tag tree and the context menu's separate list, and compares exact, descendant-only, and combined ignored-note patterns with lookup results. It also checks hidden-tag completion and similar-note initial conditions. Its notes include both inline and frontmatter tags.

The suite is currently validated on Linux only. Its explicit preparation command downloads the official Obsidian 1.12.7 AppImage into the ignored `_testdata/obsidian` cache and extracts the matching `obsidian-cli`. Repeated runs reuse the cached download and extraction. Set `OBSIDIAN_BINARY` and `OBSIDIAN_CLI` when using executables outside the shared discovery paths.

```bash
npm run prepare:e2e:obsidian
npm run check:e2e:obsidian
npm run test:e2e:obsidian:new-note-template
npm run test:e2e:obsidian:note-lookup
npm run test:e2e:obsidian:tag-tree-style
npm run test:e2e:obsidian:locale-tag-order
npm run test:e2e:obsidian:tag-filters
```

The five test commands invoke the preparation command automatically. Run them sequentially on hosts with limited memory. Running preparation separately is useful for checking the selected version and executable paths. Importing the test-session package never downloads Obsidian; only the explicit preparation command performs network and filesystem writes.

Set `E2E_OBSIDIAN_KEEP_VAULT=true` to preserve the temporary vault and isolated application state for debugging.
