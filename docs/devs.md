# Developer guide

## Setup and checks

Install the locked dependencies and run the repository gate:

```bash
npm ci
npm run check
npm run build
```

The App-free Vitest suite includes TagFolder tree utilities and the new-note application workflow.

## UI and Vault boundaries

The plug-in owns one `UiInteractions` capability and one `VaultTextAccess` capability for its lifetime:

```ts
this.ui = createObsidianUi(this.app);
this.vaultText = createObsidianVaultTextAccess(this.app.vault);
```

`new-note-workflow.ts` accepts those capabilities instead of constructing an Obsidian template modal or reading and writing `TFile` instances directly. TagFolder still owns template variables, frontmatter policy, note creation, settings, and visible labels.

Application-flow tests use instance-scoped App-free harnesses:

```ts
const ui = createUiTestHarness([
	{ kind: "pickOne", interactionId: "new-note-template", value: template },
]);
const vault = createVaultTextTestHarness({
	files: {
		"Templates/project.md": "# {{tagName}}",
		"Untitled.md": "",
	},
});
```

The UI transcript verifies the stable interaction ID and selected object identity. The Vault transcript verifies template reads, note writes, write ordering, and the absence of text writes when frontmatter owns the update.

The path-based Vault capability deliberately does not replace real Obsidian coverage for `TFile` identity, Vault events, MetadataCache propagation, or frontmatter processing.

## Fancy Kit dependencies

The three Fancy Kit packages are pinned to exact npm versions so the tested dependency set remains reproducible. Review and update the UI interactions, Obsidian plug-in kit, and test-session versions together when adopting a newer contract.

Real-Obsidian scenarios are local-only and currently validated on Linux only.

```bash
npm run check:e2e:obsidian
npm run test:e2e:obsidian:new-note-template
```

The real scenario uses the production UI and Vault adapters. It selects a template through Obsidian, creates a real note, and verifies the persisted content; it never installs a scripted driver into the plug-in.
