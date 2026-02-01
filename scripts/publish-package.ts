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
import { join } from "node:path";
import { z } from "zod";

const PackageJsonSchema = z.object({
  name: z.string(),
  version: z.string(),
  publishConfig: z
    .object({
      access: z.enum(["public", "restricted"]),
    })
    .optional(),
});

interface PublishResult {
  packageName: string;
  localVersion: string;
  npmVersion: string;
  published: boolean;
}

async function publishPackage(packageName: string, packagePath: string): Promise<PublishResult> {
  // Read local package.json using Bun's native JSON support
  const packageJsonPath = join(packagePath, "package.json");
  const packageJsonRaw = await Bun.file(packageJsonPath).json();
  const packageJson = PackageJsonSchema.parse(packageJsonRaw);
  const localVersion = packageJson.version;

  // Get current npm version
  let npmVersion = "0.0.0";
  try {
    const result = await $`npm view ${packageName} version`.text();
    npmVersion = result.trim();
  } catch {
    // Package doesn't exist on npm yet
    npmVersion = "0.0.0";
  }

  console.log(`\n📦 ${packageName}`);
  console.log(`   Local version: ${localVersion}`);
  console.log(`   NPM version:   ${npmVersion}`);

  // Set GitHub output
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `local_version=${localVersion}\nnpm_version=${npmVersion}\n`
    );
  }

  if (localVersion === npmVersion) {
    console.log(`   ⏭️  Skipped (already published)`);
    if (process.env.GITHUB_OUTPUT) {
      await appendFile(process.env.GITHUB_OUTPUT, `published=false\n`);
    }
    return {
      packageName,
      localVersion,
      npmVersion,
      published: false,
    };
  }

  console.log(`   📤 Publishing...`);

  // Publish to npm
  await $`cd ${packagePath} && bun publish --access public --tolerate-republish`;

  // Create GitHub release (this creates the tag and release atomically)
  const tag = `${packageName}@${localVersion}`;
  const releaseTitle = `${packageName} v${localVersion}`;
  const releaseNotes = `Published to npm: https://www.npmjs.com/package/${packageName}/v/${localVersion}`;

  await $`gh release create ${tag} --title ${releaseTitle} --notes ${releaseNotes}`;

  console.log(`   ✅ Published`);

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `published=true\n`);
  }

  return {
    packageName,
    localVersion,
    npmVersion,
    published: true,
  };
}

// Parse arguments
const [name] = process.argv.slice(2);

if (!name) {
  console.error("Usage: bun scripts/publish-package.ts <package-name>");
  console.error("Example: bun scripts/publish-package.ts wildcard");
  process.exit(1);
}

// Construct full package name and path
const packageName = `@just-be/${name}`;
const packagePath = `packages/${name}`;

// Run the script
try {
  await publishPackage(packageName, packagePath);
} catch (error) {
  console.error(`\n❌ Error publishing ${packageName}:`, error);
  process.exit(1);
}
