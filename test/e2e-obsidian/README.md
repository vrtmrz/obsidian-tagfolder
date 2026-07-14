# Real Obsidian E2E

This local-only suite installs the built TagFolder plug-in into an isolated vault and profile through `@vrtmrz/obsidian-test-session`. It is not part of the default CI gate.

The new-note scenario selects a seeded template through the real Obsidian picker, verifies its secondary path description, creates a note through TagFolder, and checks the resulting Vault content. The note-lookup scenario drives the real TagFolder commands and Svelte dialogue, adds positive and excluded tags through the keyboard, changes field focus, opens the selected note, and verifies similar-note initialisation. Neither scenario uses scripted UI or Vault responses.

The suite is currently validated on Linux only. Its explicit preparation command downloads the official Obsidian 1.12.7 AppImage into the ignored `_testdata/obsidian` cache and extracts the matching `obsidian-cli`. Repeated runs reuse the cached download and extraction. Set `OBSIDIAN_BINARY` and `OBSIDIAN_CLI` when using executables outside the shared discovery paths.

```bash
npm run prepare:e2e:obsidian
npm run check:e2e:obsidian
npm run test:e2e:obsidian:new-note-template
npm run test:e2e:obsidian:note-lookup
```

The two test commands invoke the preparation command automatically. Running it separately is useful for checking the selected version and executable paths. Importing the test-session package never downloads Obsidian; only the explicit preparation command performs network and filesystem writes.

Set `E2E_OBSIDIAN_KEEP_VAULT=true` to preserve the temporary vault and isolated application state for debugging.
