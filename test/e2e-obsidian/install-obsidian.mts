import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { installObsidianAppImage } from "@vrtmrz/obsidian-test-session";

const OBSIDIAN_E2E_VERSION = "1.12.7";
const targetDirectory = resolve("_testdata/obsidian");

if (process.platform != "linux") {
	throw new Error("Automated Obsidian AppImage installation is supported on Linux only");
}

const installation = await installObsidianAppImage({
	version: OBSIDIAN_E2E_VERSION,
	targetDirectory,
});
const cliBinary = join(targetDirectory, "squashfs-root", "obsidian-cli");

await access(installation.extractedBinary, constants.X_OK);
await access(cliBinary, constants.X_OK);

console.log(`Prepared Obsidian ${installation.version} (${installation.architecture})`);
console.log(`OBSIDIAN_BINARY=${installation.extractedBinary}`);
console.log(`OBSIDIAN_CLI=${cliBinary}`);
