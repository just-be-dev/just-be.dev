#!/usr/bin/env bun

/**
 * Deploy static sites and setup routing for the wildcard subdomain service
 *
 * Usage:
 *   bunx @just-be/deploy                        # Looks for deploy.json in current directory
 *   bunx @just-be/deploy path/to/config.json    # Deploy with specific config file
 *   bunx @just-be/deploy preview <subdomain>    # Preview deploy with branch name suffix
 *   bunx @just-be/deploy --version              # Show version
 *
 * Authentication:
 *   The script will automatically run 'wrangler login' if you're not authenticated.
 *   Alternatively, set CLOUDFLARE_API_TOKEN environment variable.
 *
 * Environment Variables:
 *   R2_BUCKET_NAME   # R2 bucket name
 *   KV_NAMESPACE_ID  # KV namespace ID
 *   DEBUG            # Set to "1" or "true" to enable verbose error output
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
 *
 * Preview deploys append the branch name to the subdomain (e.g., "myapp-feature-branch").
 */

import { $ } from "bun";
import { readdir, stat, access } from "fs/promises";
import { join, relative, resolve } from "path";
import { intro, outro, spinner } from "@clack/prompts";
import { z } from "zod";
import packageJson from "./package.json" with { type: "json" };
import {
  StaticConfigSchema,
  RedirectConfigSchema,
  RewriteConfigSchema,
  type RouteConfig,
  subdomain,
} from "@just-be/wildcard";

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "content-bucket";
const KV_NAMESPACE_ID = process.env.KV_NAMESPACE_ID || "6118ae3b937c4883b3c582dfef8a0c05";
const DEBUG = process.env.DEBUG === "1" || process.env.DEBUG === "true";

/**
 * Run wrangler command using bunx to ensure it resolves from package dependencies
 * Takes variable arguments and passes them as separate shell arguments
 *
 * @example
 * wrangler('r2', 'object', 'put', 'bucket/key', '--file', 'path')
 */
function wrangler(...args: string[]) {
  return $`bunx wrangler ${args}`;
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
    await wrangler("r2", "object", "put", `${BUCKET_NAME}/${r2Key}`, "--file", localPath);
    return true;
  } catch (error) {
    if (DEBUG) {
      console.error(`\nFailed to upload ${localPath}:`);
      console.error("Error details:", error);
      if (error instanceof Error) {
        console.error("Stack trace:", error.stack);
      }
    } else {
      console.error(`\nFailed to upload ${localPath}:`, error);
    }
    return false;
  }
}

/**
 * Check if user is authenticated with wrangler
 */
async function validateWranglerAuth(): Promise<boolean> {
  try {
    await wrangler("whoami").quiet();
    return true;
  } catch (error) {
    if (DEBUG) {
      console.error("\nWrangler auth validation failed:");
      console.error("Error details:", error);
      if (error instanceof Error) {
        console.error("Stack trace:", error.stack);
      }
    }
    return false;
  }
}

/**
 * Validate KV access by attempting to list keys
 */
async function validateKVAccess(): Promise<boolean> {
  try {
    await wrangler("kv", "key", "list", "--namespace-id", KV_NAMESPACE_ID).quiet();
    return true;
  } catch (error) {
    if (DEBUG) {
      console.error("\nKV access validation failed:");
      console.error("Error details:", error);
      if (error instanceof Error) {
        console.error("Stack trace:", error.stack);
      }
      console.error(`Namespace ID: ${KV_NAMESPACE_ID}`);
    }
    return false;
  }
}

/**
 * Get the current git branch name
 */
async function getCurrentBranch(): Promise<string> {
  try {
    const result = await $`git rev-parse --abbrev-ref HEAD`.text();
    return result.trim();
  } catch (error) {
    if (DEBUG) {
      console.error("\nFailed to get current git branch:");
      console.error("Error details:", error);
      if (error instanceof Error) {
        console.error("Stack trace:", error.stack);
      }
    }
    throw new Error("Failed to get current git branch. Are you in a git repository?");
  }
}

/**
 * Sanitize branch name for use in subdomain
 * Replaces invalid characters with hyphens and converts to lowercase
 */
function sanitizeBranchName(branch: string): string {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Create KV entry for subdomain routing
 */
async function createKVEntry(subdomain: string, routeConfig: RouteConfig): Promise<void> {
  const configJson = JSON.stringify(routeConfig);
  await wrangler("kv", "key", "put", "--namespace-id", KV_NAMESPACE_ID, subdomain, configJson);
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

  // Parse CLI arguments
  const args = Bun.argv.slice(2);
  const isPreview = args[0] === "preview";

  let config: DeployConfig;
  let rulesToDeploy: (StaticRule | RedirectRule | RewriteRule)[];

  if (isPreview) {
    // Preview mode: deploy preview <subdomain> [config-path]
    const targetSubdomain = args[1];
    const configPath = args[2];

    if (!targetSubdomain) {
      console.error("Error: Subdomain is required for preview deploy");
      console.error("Usage: bunx @just-be/deploy preview <subdomain> [config-path]");
      process.exit(1);
    }

    // Get current branch
    const branch = await getCurrentBranch();
    const sanitizedBranch = sanitizeBranchName(branch);

    console.log(`\n📋 Preview Deploy Mode`);
    console.log(`   Branch: ${branch}`);
    console.log(`   Sanitized: ${sanitizedBranch}`);

    // Load config
    config = await findAndParseConfig(configPath);

    // Find the matching rule
    const matchingRule = config.rules.find((rule) => rule.subdomain === targetSubdomain);

    if (!matchingRule) {
      console.error(`\nError: No rule found with subdomain "${targetSubdomain}"`);
      console.error(`\nAvailable subdomains: ${config.rules.map((r) => r.subdomain).join(", ")}`);
      process.exit(1);
    }

    if (matchingRule.type !== "static") {
      console.error(`\nError: Preview deploys only support static rules`);
      console.error(`The rule "${targetSubdomain}" is of type "${matchingRule.type}"`);
      process.exit(1);
    }

    // Clone rule and modify subdomain
    const previewSubdomain = `${targetSubdomain}-${sanitizedBranch}`;
    const previewRule: StaticRule = {
      ...matchingRule,
      subdomain: previewSubdomain,
    };

    rulesToDeploy = [previewRule];
    console.log(`   Preview subdomain: ${previewSubdomain}.just-be.dev\n`);
  } else {
    // Normal mode: deploy all rules
    const configPath = args[0];
    config = await findAndParseConfig(configPath);
    rulesToDeploy = config.rules;
    console.log(`\nFound ${config.rules.length} rule(s) to deploy`);
  }

  // Check wrangler authentication first
  const s = spinner();
  s.start("Checking wrangler authentication");
  const isAuthenticated = await validateWranglerAuth();
  if (!isAuthenticated) {
    s.stop("Not authenticated with wrangler");
    console.log("\nAuthenticating with Cloudflare...");
    console.log("This will open a browser window for you to authorize access.\n");

    try {
      await wrangler("login");
      console.log("\n✓ Successfully authenticated!");

      // Verify authentication worked
      s.start("Verifying authentication");
      const isNowAuthenticated = await validateWranglerAuth();
      if (!isNowAuthenticated) {
        s.stop("Error: Authentication verification failed");
        console.error("\nIf you prefer to use an API token instead:");
        console.error("  export CLOUDFLARE_API_TOKEN=your-token");
        process.exit(1);
      }
      s.stop("✓ Authentication verified");
    } catch {
      console.error("\n❌ Authentication failed");
      console.error("\nAlternatively, you can set up an API token:");
      console.error("  export CLOUDFLARE_API_TOKEN=your-token");
      process.exit(1);
    }
  } else {
    s.stop("✓ Wrangler authenticated");
  }

  // Validate KV access
  s.start("Validating KV access");
  const hasKVAccess = await validateKVAccess();
  if (!hasKVAccess) {
    s.stop("Error: Cannot access KV namespace");
    console.error("\nCheck that you have permission to access the KV namespace.");
    console.error(`KV Namespace ID: ${KV_NAMESPACE_ID}`);
    console.error("\nYou may need to:");
    console.error("  1. Verify the namespace ID is correct");
    console.error("  2. Ensure your account has access to this KV namespace");
    console.error("  3. Check wrangler.toml configuration if using one");
    process.exit(1);
  }
  s.stop("✓ KV access validated");

  // Deploy each rule
  const deployedSubdomains: string[] = [];
  for (const rule of rulesToDeploy) {
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

// Only run when this file is executed directly, not when imported
if (import.meta.main) {
  const args = Bun.argv.slice(2);

  // Handle version command
  if (args[0] === "--version" || args[0] === "-v") {
    console.log(packageJson.version);
    process.exit(0);
  }

  deploy().catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
}
