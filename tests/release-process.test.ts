/* eslint-disable import/no-nodejs-modules -- Release-process tests exercise Node.js scripts. */
/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const versionBumpScript = join(repositoryRoot, "version-bump.mjs");
const releaseProcessScript = join(repositoryRoot, "release-process.mjs");
const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function createReleaseFixture(version: string): string {
	const directory = mkdtempSync(join(tmpdir(), "tagfolder-release-"));
	temporaryDirectories.push(directory);
	writeFileSync(join(directory, "package.json"), JSON.stringify({ version }));
	writeFileSync(join(directory, "manifest.json"), JSON.stringify({ version: "0.18.17", minAppVersion: "1.7.2" }));
	writeFileSync(join(directory, "versions.json"), JSON.stringify({ "0.18.14": "1.7.2" }));
	return directory;
}

describe("release version files", () => {
	it("records every release version even when the minimum app version is unchanged", () => {
		const version = "0.18.18";
		const directory = createReleaseFixture(version);
		execFileSync(process.execPath, [versionBumpScript], {
			cwd: directory,
			env: { ...process.env, npm_package_version: version },
		});
		execFileSync(process.execPath, [releaseProcessScript, "validate", version], { cwd: directory });

		const versions = JSON.parse(readFileSync(join(directory, "versions.json"), "utf8"));
		expect(versions[version]).toBe("1.7.2");
	});

	it("moves the Unreleased notes to the target version", () => {
		const version = "0.18.18";
		const directory = createReleaseFixture(version);
		execFileSync(process.execPath, [versionBumpScript], {
			cwd: directory,
			env: { ...process.env, npm_package_version: version },
		});
		writeFileSync(join(directory, "updates.md"), "## Unreleased\n\n- Change\n");
		execFileSync(process.execPath, [releaseProcessScript, "prepare", version], { cwd: directory });

		expect(readFileSync(join(directory, "updates.md"), "utf8")).toBe("## 0.18.18\n\n- Change\n");
	});
});

describe("release workflow contracts", () => {
	it("holds the generated release PR for BRAT and a merge commit", () => {
		const workflow = readFileSync(join(repositoryRoot, ".github/workflows/prepare-release.yml"), "utf8");
		expect(workflow).toContain("Merge intentionally on hold");
		expect(workflow).toContain("Validate the published release with BRAT");
		expect(workflow).toContain("merge it with a merge commit");
		expect(workflow).toContain("gh workflow run ci.yml");
		expect(workflow).toContain("<<'EOF'");
		expect(workflow).toContain('sed -i "s/__VERSION__/${VERSION}/g"');
		expect(workflow).not.toContain("<<EOF");
	});

	it("fixes finalisation to the reviewed head and explicitly dispatches publishing", () => {
		const workflow = readFileSync(join(repositoryRoot, ".github/workflows/finalise-release.yml"), "utf8");
		expect(workflow).toContain("expected_head_sha");
		expect(workflow).toContain("actions: write");
		expect(workflow).toContain("gh workflow run release.yml");
		expect(workflow).toContain("group: finalise-release");
		expect(workflow).toContain("cancel-in-progress: false");
	});

	it("supports an explicit tag and draft state in the publishing workflow", () => {
		const workflow = readFileSync(join(repositoryRoot, ".github/workflows/release.yml"), "utf8");
		expect(workflow).toContain("tag:");
		expect(workflow).toContain("draft:");
		expect(workflow).toContain("prerelease:");
		expect(workflow).toContain("inputs.tag");
	});
});
