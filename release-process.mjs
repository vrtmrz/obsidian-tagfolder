import { existsSync, readFileSync, writeFileSync } from "node:fs";

const RELEASE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function assertReleaseVersion(version) {
	if (!RELEASE_VERSION_PATTERN.test(version)) {
		throw new Error(`Invalid release version: ${version}`);
	}
}

function prepareReleaseNotes(version) {
	if (!existsSync("updates.md")) return;
	const content = readFileSync("updates.md", "utf8");
	const targetHeading = `## ${version}`;
	if (content.startsWith(`${targetHeading}\n`) || content.startsWith(`${targetHeading}\r\n`)) return;
	if (!/^## Unreleased\r?$/m.test(content)) {
		throw new Error("updates.md has no '## Unreleased' section to prepare");
	}
	writeFileSync("updates.md", content.replace(/^## Unreleased\r?$/m, targetHeading));
}

function validateVersionFiles(version) {
	assertReleaseVersion(version);
	const packageManifest = readJson("package.json");
	const pluginManifest = readJson("manifest.json");
	const versions = readJson("versions.json");

	if (packageManifest.version !== version) {
		throw new Error(`package.json is ${packageManifest.version}, expected ${version}`);
	}
	if (pluginManifest.version !== version) {
		throw new Error(`manifest.json is ${pluginManifest.version}, expected ${version}`);
	}
	if (versions[version] !== pluginManifest.minAppVersion) {
		throw new Error(`versions.json does not map ${version} to ${pluginManifest.minAppVersion}`);
	}
	if (existsSync("updates.md")) {
		const content = readFileSync("updates.md", "utf8");
		const firstHeading = content.match(/^## .+$/m)?.[0];
		if (firstHeading !== `## ${version}`) {
			throw new Error(`updates.md starts with ${firstHeading ?? "no release heading"}, expected ## ${version}`);
		}
	}
}

const [command, version] = process.argv.slice(2);
if (!version) throw new Error("Usage: node release-process.mjs <input|prepare|validate> <version>");

if (command === "input") {
	assertReleaseVersion(version);
} else if (command === "prepare") {
	assertReleaseVersion(version);
	prepareReleaseNotes(version);
	validateVersionFiles(version);
} else if (command === "validate") {
	validateVersionFiles(version);
} else {
	throw new Error(`Unknown release-process command: ${command}`);
}
