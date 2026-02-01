#!/usr/bin/env bun

/**
 * Publish a package to npm if the version has changed
 *
 * Usage:
 *   bun scripts/publish-package.ts <package-name> <package-path>
 *   bun scripts/publish-package.ts @just-be/wildcard packages/wildcard
 */

import { $ } from "bun";
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

type PackageJson = z.infer<typeof PackageJsonSchema>;

interface PublishResult {
  packageName: string;
  localVersion: string;
  npmVersion: string;
  published: boolean;
}

async function publishPackage(
  packageName: string,
  packagePath: string
): Promise<PublishResult> {
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
    await Bun.write(
      process.env.GITHUB_OUTPUT,
      `local_version=${localVersion}\nnpm_version=${npmVersion}\n`,
      { mode: "append" }
    );
  }

  if (localVersion === npmVersion) {
    console.log(`   ⏭️  Skipped (already published)`);
    if (process.env.GITHUB_OUTPUT) {
      await Bun.write(process.env.GITHUB_OUTPUT, `published=false\n`, { mode: "append" });
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

  // Create git tag
  const tag = `${packageName}@${localVersion}`;
  await $`git tag -a ${tag} -m ${"Release " + tag}`;
  await $`git push origin ${tag}`;

  // Create GitHub release
  await $`gh release create ${tag} --title ${`${packageName} v${localVersion}`} --notes ${"Published to npm: https://www.npmjs.com/package/" + packageName + "/v/" + localVersion} --verify-tag`;

  console.log(`   ✅ Published`);

  if (process.env.GITHUB_OUTPUT) {
    await Bun.write(process.env.GITHUB_OUTPUT, `published=true\n`, { mode: "append" });
  }

  return {
    packageName,
    localVersion,
    npmVersion,
    published: true,
  };
}

// Parse arguments
const [packageName, packagePath] = process.argv.slice(2);

if (!packageName || !packagePath) {
  console.error("Usage: bun scripts/publish-package.ts <package-name> <package-path>");
  console.error("Example: bun scripts/publish-package.ts @just-be/wildcard packages/wildcard");
  process.exit(1);
}

// Run the script
try {
  await publishPackage(packageName, packagePath);
} catch (error) {
  console.error(`\n❌ Error publishing ${packageName}:`, error);
  process.exit(1);
}
