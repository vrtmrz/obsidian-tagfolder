# Real Obsidian E2E

This local-only suite installs the built TagFolder plug-in into an isolated vault and profile through `@vrtmrz/obsidian-test-session`. It is not part of the default CI gate.

The new-note scenario selects a seeded template through the real Obsidian picker, verifies its secondary path description, creates a note through TagFolder, and checks the resulting Vault content. It does not use scripted UI or Vault responses.

The suite is currently validated on Linux only. Set `OBSIDIAN_BINARY` and `OBSIDIAN_CLI` when the executables are outside the shared discovery paths.

```bash
npm run check:e2e:obsidian
npm run test:e2e:obsidian:new-note-template
```

Set `E2E_OBSIDIAN_KEEP_VAULT=true` to preserve the temporary vault and isolated application state for debugging.
