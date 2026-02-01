#!/usr/bin/env bun

/**
 * Deploy static files to Cloudflare R2 and configure subdomain routing in KV
 *
 * Usage:
 *   bunx @just-be/deploy --subdomain=myapp --path=apps/myapp --dir=./dist
 *   bunx @just-be/deploy --subdomain=portfolio --path=sites/portfolio --dir=./build --fallback=404.html
 *   bunx @just-be/deploy --subdomain=spa --path=apps/spa --dir=./dist --spa
 *
 * Or run interactively without arguments:
 *   bunx @just-be/deploy
 */

import { $ } from "bun";
import { readdir, stat } from "fs/promises";
import { join, relative } from "path";
import { createInterface } from "readline";
import { z } from "zod";
import { StaticConfigSchema, type StaticConfig, isValidSubdomain } from "@just-be/wildcard";

const BUCKET_NAME = "content-bucket";
const WRANGLER_CONFIG = "services/wildcard/wrangler.toml";

/**
 * Schema for CLI arguments
 */
const CliArgsSchema = z.object({
  subdomain: z.string().optional(),
  path: z.string().optional(),
  dir: z.string().optional(),
  spa: z.boolean().optional(),
  fallback: z.string().optional(),
});

type CliArgs = z.infer<typeof CliArgsSchema>;

/**
 * Parse command-line arguments from Bun.argv using a custom parser
 */
function parseCliArgs(): CliArgs {
  const args: Record<string, string | boolean> = {};

  for (const arg of Bun.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      if (value === undefined) {
        // Flag without value (e.g., --spa)
        args[key] = true;
      } else {
        args[key] = value;
      }
    }
  }

  return CliArgsSchema.parse(args);
}

interface DeployConfig extends Omit<StaticConfig, "type"> {
  subdomain: string;
  dir: string;
}

/**
 * Prompt user for input
 */
async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const promptText = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

/**
 * Prompt user for confirmation
 */
async function confirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (y/n)`, "n");
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

/**
 * Parse command-line arguments
 */
async function getConfig(): Promise<DeployConfig> {
  const values = parseCliArgs();

  // Interactive mode if any required argument is missing
  const needsInteractive = !values.subdomain || !values.path || !values.dir;

  if (needsInteractive) {
    console.log("🚀 Interactive deployment setup\n");
  }

  let subdomain =
    values.subdomain || (await prompt("Subdomain name (e.g., 'myapp' for myapp.just-be.dev)"));

  // Validate subdomain format
  if (!isValidSubdomain(subdomain)) {
    console.error(
      "\n❌ Invalid subdomain format. Must be alphanumeric with hyphens, 1-63 characters."
    );
    process.exit(1);
  }

  const path = values.path || (await prompt("R2 path prefix (e.g., 'apps/myapp')"));
  const dir = values.dir || (await prompt("Local directory to upload", "./dist"));

  let spa = values.spa;
  let fallback = values.fallback;

  // Only prompt for spa/fallback if not provided
  if (needsInteractive && spa === undefined && fallback === undefined) {
    spa = await confirm("Enable SPA mode? (all routes serve index.html)");
    if (!spa) {
      const useFallback = await confirm("Use a custom fallback file for 404s?");
      if (useFallback) {
        fallback = await prompt("Fallback file name", "404.html");
      }
    }
  }

  // Validate with Zod schema
  const staticConfig: StaticConfig = {
    type: "static",
    path,
    ...(spa && { spa }),
    ...(fallback && { fallback }),
  };

  const result = StaticConfigSchema.safeParse(staticConfig);
  if (!result.success) {
    console.error("\n❌ Invalid configuration:");
    console.error(result.error.format());
    process.exit(1);
  }

  return {
    subdomain,
    path,
    dir,
    spa,
    fallback,
  };
}

/**
 * Recursively find all files in a directory
 */
async function findFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

/**
 * Upload a file to R2
 * @returns true if upload succeeded, false otherwise
 */
async function uploadToR2(localPath: string, r2Key: string): Promise<boolean> {
  try {
    await $`wrangler r2 object put ${BUCKET_NAME}/${r2Key} --file ${localPath}`;
    return true;
  } catch (error) {
    console.error(`\n❌ Failed to upload ${localPath}:`, error);
    return false;
  }
}

/**
 * Validate KV access by attempting to list keys
 */
async function validateKVAccess(): Promise<boolean> {
  try {
    await $`wrangler kv key list --binding ROUTING_RULES --config ${WRANGLER_CONFIG}`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Create KV entry for subdomain routing
 */
async function createKVEntry(subdomain: string, config: DeployConfig): Promise<void> {
  const routingConfig: StaticConfig = {
    type: "static",
    path: config.path,
    ...(config.spa && { spa: config.spa }),
    ...(config.fallback && { fallback: config.fallback }),
  };

  const configJson = JSON.stringify(routingConfig);

  await $`wrangler kv key put --binding ROUTING_RULES ${subdomain} ${configJson} --config ${WRANGLER_CONFIG}`;
}

/**
 * Main deployment function
 */
async function deploy() {
  const config = await getConfig();

  console.log("\n📦 Deploy Configuration:");
  console.log(`  Subdomain: ${config.subdomain}.just-be.dev`);
  console.log(`  R2 Path: ${config.path}`);
  console.log(`  Local Directory: ${config.dir}`);
  if (config.spa) {
    console.log(`  Mode: SPA (all routes serve index.html)`);
  } else if (config.fallback) {
    console.log(`  Fallback: ${config.fallback}`);
  }
  console.log();

  // Verify directory exists
  try {
    const dirStat = await stat(config.dir);
    if (!dirStat.isDirectory()) {
      console.error(`❌ Error: ${config.dir} is not a directory`);
      process.exit(1);
    }
  } catch {
    console.error(`❌ Error: Directory ${config.dir} does not exist`);
    process.exit(1);
  }

  // Find all files to upload
  console.log(`📂 Scanning files in: ${config.dir}\n`);
  const filePaths = await findFiles(config.dir);
  console.log(`Found ${filePaths.length} files to upload\n`);

  if (filePaths.length === 0) {
    console.error("❌ No files found to upload");
    process.exit(1);
  }

  // Validate KV access before starting uploads
  console.log("🔍 Validating KV access...");
  const hasKVAccess = await validateKVAccess();
  if (!hasKVAccess) {
    console.error(
      "❌ Error: Cannot access KV namespace. Check wrangler configuration and permissions."
    );
    process.exit(1);
  }
  console.log("✅ KV access validated\n");

  // Upload files to R2
  let uploadCount = 0;
  const failedUploads: string[] = [];

  for (const filePath of filePaths) {
    const relativePath = relative(config.dir, filePath);
    const r2Key = `${config.path}/${relativePath}`;

    console.log(`⬆️  ${relativePath} → ${r2Key}`);
    const success = await uploadToR2(filePath, r2Key);

    if (success) {
      uploadCount++;
    } else {
      failedUploads.push(relativePath);
    }
  }

  // Report upload results
  if (failedUploads.length > 0) {
    console.error(`\n❌ Failed to upload ${failedUploads.length} file(s):`);
    for (const file of failedUploads) {
      console.error(`   - ${file}`);
    }
    process.exit(1);
  }

  console.log(`\n✅ Uploaded ${uploadCount} files to R2\n`);

  // Create KV entry for routing
  console.log(`🔧 Creating KV routing entry for subdomain: ${config.subdomain}`);
  try {
    await createKVEntry(config.subdomain, config);
  } catch (error) {
    console.error(
      `\n❌ Error: Failed to create KV entry. Files were uploaded but routing is not configured.`
    );
    console.error(`   Uploaded files location: ${config.path}`);
    console.error(`   Error:`, error);
    process.exit(1);
  }

  console.log(`\n✅ Deployment complete!`);
  console.log(`\n🌐 Your site is available at: https://${config.subdomain}.just-be.dev`);
}

deploy().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
