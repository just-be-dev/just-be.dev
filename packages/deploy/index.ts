#!/usr/bin/env bun

/**
 * Deploy static sites and setup routing for the wildcard subdomain service
 *
 * Usage:
 *   bunx @just-be/deploy                    # Looks for deploy.json in current directory
 *   bunx @just-be/deploy path/to/config.json
 *
 * Example deploy.json:
 *   {
 *     "rules": [
 *       {
 *         "subdomain": "myapp",
 *         "type": "static",
 *         "dir": "./dist",
 *         "spa": true
 *       },
 *       {
 *         "subdomain": "old-site",
 *         "type": "redirect",
 *         "url": "https://new-site.com",
 *         "permanent": true
 *       }
 *     ]
 *   }
 *
 * Note: The subdomain is automatically used as the R2 path prefix.
 * For example, subdomain "myapp" will store files under "myapp/" in R2.
 */

import { $ } from "bun";
import { readdir, stat, access } from "fs/promises";
import { join, relative, resolve } from "path";
import { intro, outro, spinner } from "@clack/prompts";
import { z } from "zod";
import {
  StaticConfigSchema,
  RedirectConfigSchema,
  RewriteConfigSchema,
  type RouteConfig,
  subdomain,
} from "@just-be/wildcard";

const BUCKET_NAME = "content-bucket";
const WRANGLER_CONFIG = "services/wildcard/wrangler.toml";

/**
 * Run wrangler command using bunx to ensure it resolves from package dependencies
 */
function wrangler(command: TemplateStringsArray, ...values: unknown[]) {
  const cmd = String.raw(command, ...values);
  return $`bunx wrangler ${cmd}`;
}

/**
 * Route rules extend RouteConfig with subdomain
 * Static rules also need a `dir` field for the local directory to upload
 * The subdomain is automatically used as the R2 path prefix
 * Using safeExtend because base schemas contain refinements
 */
const StaticRuleSchema = StaticConfigSchema.safeExtend({
  subdomain: subdomain(),
  dir: z.string().min(1),
});

const RedirectRuleSchema = RedirectConfigSchema.safeExtend({
  subdomain: subdomain(),
});

const RewriteRuleSchema = RewriteConfigSchema.safeExtend({
  subdomain: subdomain(),
});

const RouteRuleSchema = z.discriminatedUnion("type", [
  StaticRuleSchema,
  RedirectRuleSchema,
  RewriteRuleSchema,
]);

export const DeployConfigSchema = z.object({
  rules: z.array(RouteRuleSchema).min(1, "At least one rule is required"),
});

type StaticRule = z.infer<typeof StaticRuleSchema>;
type RedirectRule = z.infer<typeof RedirectRuleSchema>;
type RewriteRule = z.infer<typeof RewriteRuleSchema>;
type DeployConfig = z.infer<typeof DeployConfigSchema>;

/**
 * Find and parse deploy configuration file
 */
async function findAndParseConfig(providedPath?: string): Promise<DeployConfig> {
  let configPath: string;

  if (providedPath) {
    // Use provided path
    configPath = resolve(providedPath);
  } else {
    // Look for deploy.json in current directory
    configPath = join(process.cwd(), "deploy.json");

    const hasJson = await access(configPath)
      .then(() => true)
      .catch(() => false);

    if (!hasJson) {
      console.error("Error: No deploy.json found in current directory");
      console.error("Run 'bunx @just-be/deploy path/to/config.json' to specify a config file");
      process.exit(1);
    }
  }

  // Parse JSON file
  const content = await Bun.file(configPath).text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error("Error: Failed to parse JSON config file");
    console.error(error);
    process.exit(1);
  }

  // Validate with schema
  const result = DeployConfigSchema.safeParse(parsed);
  if (!result.success) {
    console.error("\nInvalid configuration:");
    console.error(z.prettifyError(result.error));
    process.exit(1);
  }

  return result.data;
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
 */
async function uploadToR2(localPath: string, r2Key: string): Promise<boolean> {
  try {
    await wrangler`r2 object put ${BUCKET_NAME}/${r2Key} --file ${localPath}`;
    return true;
  } catch (error) {
    console.error(`\nFailed to upload ${localPath}:`, error);
    return false;
  }
}

/**
 * Validate KV access by attempting to list keys
 */
async function validateKVAccess(): Promise<boolean> {
  try {
    await wrangler`kv key list --binding ROUTING_RULES --config ${WRANGLER_CONFIG}`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Create KV entry for subdomain routing
 */
async function createKVEntry(subdomain: string, routeConfig: RouteConfig): Promise<void> {
  const configJson = JSON.stringify(routeConfig);
  await wrangler`kv key put --binding ROUTING_RULES ${subdomain} ${configJson} --config ${WRANGLER_CONFIG}`;
}

/**
 * Deploy a static site rule
 */
async function deployStaticRule(rule: StaticRule, s: ReturnType<typeof spinner>): Promise<void> {
  console.log(`\n📦 Deploying static site: ${rule.subdomain}.just-be.dev`);
  console.log(`   Local Directory: ${rule.dir}`);
  if (rule.spa) {
    console.log(`   Mode: SPA`);
  } else if (rule.fallback) {
    console.log(`   Fallback: ${rule.fallback}`);
  }

  // Verify directory exists
  try {
    const dirStat = await stat(rule.dir);
    if (!dirStat.isDirectory()) {
      throw new Error(`${rule.dir} is not a directory`);
    }
  } catch (error) {
    console.error(`Error: Directory ${rule.dir} does not exist or is not accessible`);
    throw error;
  }

  // Find all files to upload
  s.start(`Scanning files in: ${rule.dir}`);
  const filePaths = await findFiles(rule.dir);
  s.stop(`Found ${filePaths.length} files to upload`);

  if (filePaths.length === 0) {
    throw new Error("No files found to upload");
  }

  // Upload files to R2
  let uploadCount = 0;
  const failedUploads: string[] = [];

  for (const filePath of filePaths) {
    const relativePath = relative(rule.dir, filePath);
    const r2Key = `${rule.subdomain}/${relativePath}`;

    s.start(`Uploading ${relativePath}`);
    const success = await uploadToR2(filePath, r2Key);

    if (success) {
      uploadCount++;
      s.stop(`Uploaded ${relativePath}`);
    } else {
      s.stop(`Failed to upload ${relativePath}`);
      failedUploads.push(relativePath);
    }
  }

  if (failedUploads.length > 0) {
    throw new Error(`Failed to upload ${failedUploads.length} file(s)`);
  }

  console.log(`✓ Uploaded ${uploadCount} files to R2`);

  // Create KV entry (path is derived from subdomain at runtime)
  const routeConfig: RouteConfig = {
    type: "static",
    ...(rule.spa && { spa: rule.spa }),
    ...(rule.fallback && { fallback: rule.fallback }),
  };

  s.start(`Creating KV routing entry`);
  await createKVEntry(rule.subdomain, routeConfig);
  s.stop(`✓ KV routing entry created`);
}

/**
 * Deploy a redirect rule
 */
async function deployRedirectRule(
  rule: RedirectRule,
  s: ReturnType<typeof spinner>
): Promise<void> {
  console.log(`\n🔀 Configuring redirect: ${rule.subdomain}.just-be.dev`);
  console.log(`   Target URL: ${rule.url}`);
  console.log(`   Permanent: ${rule.permanent ?? false}`);

  const routeConfig: RouteConfig = {
    type: "redirect",
    url: rule.url,
    ...(rule.permanent !== undefined && { permanent: rule.permanent }),
  };

  s.start(`Creating KV routing entry`);
  await createKVEntry(rule.subdomain, routeConfig);
  s.stop(`✓ KV routing entry created`);
}

/**
 * Deploy a rewrite rule
 */
async function deployRewriteRule(rule: RewriteRule, s: ReturnType<typeof spinner>): Promise<void> {
  console.log(`\n🔄 Configuring rewrite: ${rule.subdomain}.just-be.dev`);
  console.log(`   Target URL: ${rule.url}`);
  console.log(`   Allowed Methods: ${rule.allowedMethods?.join(", ") || "GET, HEAD, OPTIONS"}`);

  const routeConfig: RouteConfig = {
    type: "rewrite",
    url: rule.url,
    ...(rule.allowedMethods && { allowedMethods: rule.allowedMethods }),
  };

  s.start(`Creating KV routing entry`);
  await createKVEntry(rule.subdomain, routeConfig);
  s.stop(`✓ KV routing entry created`);
}

/**
 * Main deployment function
 */
async function deploy() {
  intro("🚀 Just-Be Deploy");

  // Get config file path from first argument if provided
  const configPath = Bun.argv[2];
  const config = await findAndParseConfig(configPath);

  console.log(`\nFound ${config.rules.length} rule(s) to deploy`);

  // Validate KV access before starting
  const s = spinner();
  s.start("Validating KV access");
  const hasKVAccess = await validateKVAccess();
  if (!hasKVAccess) {
    s.stop("Error: Cannot access KV namespace");
    console.error("Check wrangler configuration and permissions.");
    process.exit(1);
  }
  s.stop("✓ KV access validated");

  // Deploy each rule
  const deployedSubdomains: string[] = [];
  for (const rule of config.rules) {
    try {
      switch (rule.type) {
        case "static":
          await deployStaticRule(rule, s);
          deployedSubdomains.push(`https://${rule.subdomain}.just-be.dev`);
          break;
        case "redirect":
          await deployRedirectRule(rule, s);
          deployedSubdomains.push(`https://${rule.subdomain}.just-be.dev → ${rule.url}`);
          break;
        case "rewrite":
          await deployRewriteRule(rule, s);
          deployedSubdomains.push(`https://${rule.subdomain}.just-be.dev ⟲ ${rule.url}`);
          break;
      }
    } catch (error) {
      console.error(`\n❌ Failed to deploy ${rule.subdomain}:`, error);
      process.exit(1);
    }
  }

  outro("\n✅ Deployment complete!\n\nDeployed sites:\n" + deployedSubdomains.join("\n"));
}

// Only run deploy() when this file is executed directly, not when imported
if (import.meta.main) {
  deploy().catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
}
