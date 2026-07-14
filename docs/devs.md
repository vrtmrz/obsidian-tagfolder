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

The plug-in owns one `UiInteractions` capability, one `VaultTextAccess` capability, and one `VaultFrontmatterAccess` capability for its lifetime:

```ts
this.ui = createObsidianUi(this.app);
this.vaultText = createObsidianVaultTextAccess(this.app.vault);
this.vaultFrontmatter = createObsidianVaultFrontmatterAccess(this.app);
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
const frontmatter = createVaultFrontmatterTestHarness({
	files: { "Untitled.md": { tags: [] } },
});
```

The UI transcript verifies the stable interaction ID and selected object identity. The Vault text transcript verifies template reads, note writes, write ordering, and the absence of text writes when frontmatter owns the update. The frontmatter transcript verifies tag merging and rollback when a simulated update fails.

The path-based Vault capability deliberately does not replace real Obsidian coverage for `TFile` identity, Vault events, MetadataCache propagation, or frontmatter processing.

## Fancy Kit dependencies

The three Fancy Kit packages are pinned to exact npm versions so the tested dependency set remains reproducible. Review and update the UI interactions, Obsidian plug-in kit, and test-session versions together when adopting a newer contract.

Real-Obsidian scenarios are local-only and currently validated on Linux only.

```bash
npm run check:e2e:obsidian
npm run test:e2e:obsidian:new-note-template
```

The real scenario uses the production UI and Vault adapters. It selects a template through Obsidian, creates real notes, and verifies both persisted template content and frontmatter tags; it never installs a scripted driver into the plug-in.

## Release process

The repository uses three manually gated workflows. Configure the GitHub `release` environment with a required reviewer before using them.

1. Run `Prepare Release PR` with the target version. It checks out `main`, runs the locked build and test gate, updates `package.json`, `manifest.json`, `versions.json`, and the `Unreleased` section in `updates.md`, pushes `release/<version>`, opens a draft pull request, and explicitly dispatches CI for the release branch. Explicit dispatch is required because branch and pull-request events created with `GITHUB_TOKEN` do not start another workflow.
2. Review the release changes and release notes. Keep the pull request in draft and record its full head commit SHA.
3. Run `Finalise Release Tags` with the version and reviewed SHA, then approve its `release` environment deployment. It validates the exact branch head, creates the tag, and explicitly dispatches `Release Obsidian Plugin`. Explicit dispatch is required because a tag pushed with `GITHUB_TOKEN` does not start a tag-push workflow.
4. Approve the separate `Release Obsidian Plugin` deployment to the `release` environment, inspect the draft GitHub Release and its assets, then publish it as the latest stable release while leaving the release pull request in draft.
5. Install the published build through BRAT and verify start-up, tree display, new-note templates, frontmatter tags, and any regression scenario relevant to the release.
6. After BRAT succeeds, mark the pull request ready and merge it with a merge commit. A merge commit keeps the tagged release commit in `main` history.

If BRAT validation fails, do not move or replace the published tag. Leave the pull request in draft and prepare a new patch release. If the tag exists but publishing dispatch or build fails, rerun `Release Obsidian Plugin` manually for the existing tag instead of rerunning Finalise.
