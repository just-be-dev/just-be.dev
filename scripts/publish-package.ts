#!/usr/bin/env bun

/**
 * Publish a package to npm if the version has changed
 *
 * Usage:
 *   bun scripts/publish-package.ts <package-name>
 *   bun scripts/publish-package.ts wildcard
 *
 * The script automatically:
 * - Adds @just-be/ scope to the package name
 * - Looks for the package in packages/<package-name>
 */

import { $ } from "bun";
import { appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { generateReleaseNotes, getGitHubRepo } from "./release-notes";

const PackageJsonSchema = z.object({
  name: z.string(),
  version: z.string(),
  publishConfig: z
    .object({
      access: z.enum(["public", "restricted"]),
    })
    .optional(),
});

export interface PublishResult {
  packageName: string;
  localVersion: string;
  npmVersion: string;
  published: boolean;
}

export interface PackageInfo {
  name: string;
  version: string;
}

export async function main(): Promise<void> {
  const [name] = process.argv.slice(2);

  if (!name) {
    console.error("Usage: bun scripts/publish-package.ts <package-name>");
    console.error("Example: bun scripts/publish-package.ts wildcard");
    process.exit(1);
  }

  // Construct full package name and path
  const packageName = `@just-be/${name}`;
  const packagePath = `packages/${name}`;

  // Run the publish process
  try {
    await publishPackage(packageName, packagePath);
  } catch (error) {
    console.error(`\nError publishing ${packageName}:`, error);
    process.exit(1);
  }
}

/**
 * Read and parse package.json
 */
export async function getPackageInfo(packagePath: string): Promise<PackageInfo> {
  const packageJsonPath = join(packagePath, "package.json");
  const packageJsonRaw = await Bun.file(packageJsonPath).json();
  const packageJson = PackageJsonSchema.parse(packageJsonRaw);
  return {
    name: packageJson.name,
    version: packageJson.version,
  };
}

/**
 * Get the current version of a package from npm registry
 * Returns "0.0.0" if the package doesn't exist
 */
export async function getNpmVersion(packageName: string): Promise<string> {
  try {
    const result = await $`npm view ${packageName} version`.text();
    return result.trim();
  } catch {
    // Package doesn't exist on npm yet
    return "0.0.0";
  }
}

/**
 * Determine if a package should be published based on version comparison
 */
export function shouldPublish(localVersion: string, npmVersion: string): boolean {
  return localVersion !== npmVersion;
}

/**
 * Pack a package using bun pm pack
 */
export async function packPackage(packagePath: string): Promise<void> {
  await $`cd ${packagePath} && bun pm pack`;
}

/**
 * Find the packed tarball in the package directory
 */
export async function findTarball(packagePath: string): Promise<string> {
  const files = await Array.fromAsync(new Bun.Glob("*.tgz").scan({ cwd: packagePath }));
  if (files.length === 0) {
    throw new Error("No tarball found after packing");
  }
  return files[0];
}

/**
 * Publish a tarball to npm
 */
export async function publishToNpm(packagePath: string, tarball: string): Promise<void> {
  await $`cd ${packagePath} && npm publish ${tarball} --access public`;
}

/**
 * Create a GitHub release for the published package
 */
export async function createGitHubRelease(packageName: string, version: string): Promise<void> {
  const tag = `${packageName}@${version}`;
  const releaseTitle = `${packageName} v${version}`;
  const githubRepo = await getGitHubRepo();

  // Extract package name without scope (e.g., "@just-be/deploy" -> "deploy")
  const packageNameWithoutScope = packageName.replace("@just-be/", "");

  // Generate release notes
  const releaseNotes = await generateReleaseNotes(packageNameWithoutScope, version, githubRepo);

  // Use --notes-file to avoid shell escaping issues with long notes
  const notesPath = join(tmpdir(), `release-notes-${Date.now()}.md`);
  await Bun.write(notesPath, releaseNotes);

  await $`gh release create ${tag} --title ${releaseTitle} --notes-file ${notesPath}`;

  // Clean up temp file
  await Bun.file(notesPath).writer().end();
}

/**
 * Write outputs to GitHub Actions
 */
export async function writeGitHubOutputs(outputs: Record<string, string | boolean>): Promise<void> {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  const lines = Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  await appendFile(process.env.GITHUB_OUTPUT, `${lines}\n`);
}

/**
 * Main publish function that orchestrates the entire publishing process
 */
export async function publishPackage(
  packageName: string,
  packagePath: string,
): Promise<PublishResult> {
  // Get package version info
  const packageInfo = await getPackageInfo(packagePath);
  const localVersion = packageInfo.version;
  const npmVersion = await getNpmVersion(packageName);

  console.log(`\n${packageName}`);
  console.log(`   Local version: ${localVersion}`);
  console.log(`   NPM version:   ${npmVersion}`);

  await writeGitHubOutputs({
    local_version: localVersion,
    npm_version: npmVersion,
  });

  // Check if publishing is needed
  if (!shouldPublish(localVersion, npmVersion)) {
    console.log(`   Skipped (already published)`);
    await writeGitHubOutputs({ published: false });
    return {
      packageName,
      localVersion,
      npmVersion,
      published: false,
    };
  }

  console.log(`   Publishing...`);

  // Pack the package
  await packPackage(packagePath);

  // Find the tarball
  const tarball = await findTarball(packagePath);

  // Publish to npm
  await publishToNpm(packagePath, tarball);

  // Create GitHub release
  await createGitHubRelease(packageName, localVersion);

  console.log(`   Published`);
  await writeGitHubOutputs({ published: true });

  return {
    packageName,
    localVersion,
    npmVersion,
    published: true,
  };
}

// Only run the script if executed directly (not when imported)
if (import.meta.main) {
  await main();
}
