#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { YAML } from "bun";
import { Code } from "../src/utils/code";

const CONTENT_DIR = `${import.meta.dir}/../src/content`;
const MANIFEST_PATH = `${import.meta.dir}/../src/content/url-manifest.yaml`;
const DEFAULT_COLLECTIONS = ["blog", "games", "research", "projects", "talks", "micro"];

interface UrlManifest {
  version: string;
  codes: Record<string, string[]>; // code -> list of slugs
}

/**
 * Parse frontmatter from MDX content
 */
function parseFrontmatter(content: string): { data: Record<string, any>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: content };
  }

  const yamlStr = match[1];
  const body = match[2];
  const data = YAML.parse(yamlStr) as Record<string, any>;

  return { data, body };
}

/**
 * Process micro posts from R2 JSONL
 */
async function processMicroCollection(
  manifest: UrlManifest,
  existingSlugToCode: Map<string, string>,
  seenSlugsInCurrentRun: Map<string, string>,
): Promise<{ processed: number; skipped: number; errors: number }> {
  console.log("Processing collection: micro");

  try {
    const { getPlatformProxy } = await import("wrangler");
    const projectRoot = import.meta.dir + "/..";
    const { env, dispose } = await getPlatformProxy<{ MICRO_BUCKET: R2Bucket }>({
      configPath: `${projectRoot}/wrangler.toml`,
      persist: { path: `${projectRoot}/.wrangler/state/v3` },
    });

    if (!env.MICRO_BUCKET) {
      console.log("  [WARN] Skipping micro posts: MICRO_BUCKET not available\n");
      await dispose();
      return { processed: 0, skipped: 0, errors: 0 };
    }

    const obj = await env.MICRO_BUCKET.get("micro-posts.jsonl");
    await dispose();

    if (!obj) {
      console.log("  [WARN] Skipping micro posts: micro-posts.jsonl not found in R2\n");
      return { processed: 0, skipped: 0, errors: 0 };
    }

    const text = await obj.text();
    const posts = text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { id: number; createdAt: string });

    let processedCount = 0;
    let errorCount = 0;

    for (const post of posts) {
      const postId = String(post.id);
      const createdAt = new Date(post.createdAt);

      // Generate code from creation date with 'M' kind
      const code = Code.fromDate(createdAt, "M").toString().toLowerCase();

      // Micro posts use anchor URLs: /micro#<id>
      const urlPath = `/micro#${postId}`;

      try {
        // Check if this slug appears twice in current run
        if (seenSlugsInCurrentRun.has(urlPath)) {
          const previousLocation = seenSlugsInCurrentRun.get(urlPath);
          console.error(
            `  [ERROR] DUPLICATE: ${urlPath} appears in both ${previousLocation} and micro post ${postId}`,
          );
          errorCount++;
          continue;
        }
        seenSlugsInCurrentRun.set(urlPath, `micro-${postId}`);

        // Check if this slug is already assigned to a different code
        const existingCode = existingSlugToCode.get(urlPath);
        if (existingCode && existingCode !== code) {
          console.error(
            `  [ERROR] CONFLICT: ${urlPath} is already assigned to code ${existingCode}, cannot reassign to ${code}`,
          );
          errorCount++;
          continue;
        }

        // Skip if already in manifest (idempotent)
        if (manifest.codes[code]?.includes(urlPath)) {
          console.log(`  [SKIP] ${code} -> ${urlPath} (already exists)`);
          processedCount++;
          continue;
        }

        // Add new entry
        if (!manifest.codes[code]) {
          manifest.codes[code] = [];
        }
        manifest.codes[code].push(urlPath);
        existingSlugToCode.set(urlPath, code);

        console.log(`  [OK] ${code} -> ${urlPath}`);
        processedCount++;
      } catch (error) {
        console.error(
          `  [ERROR] Error processing micro post ${postId}:`,
          error instanceof Error ? error.message : error,
        );
        errorCount++;
      }
    }

    console.log();
    return {
      processed: processedCount,
      skipped: 0,
      errors: errorCount,
    };
  } catch (error) {
    console.error(
      `  [ERROR] Failed to load micro posts: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.log();
    return { processed: 0, skipped: 0, errors: 1 };
  }
}

/**
 * Process files in a single collection directory
 */
function processCollection(
  collection: string,
  manifest: UrlManifest,
  existingSlugToCode: Map<string, string>,
  seenSlugsInCurrentRun: Map<string, string>,
): { processed: number; skipped: number; errors: number } {
  const dirPath = join(CONTENT_DIR, collection);

  // Check if directory exists
  if (!existsSync(dirPath)) {
    console.log(`[WARN] Collection ${collection} does not exist, skipping...\n`);
    return { processed: 0, skipped: 0, errors: 0 };
  }

  console.log(`Processing collection: ${collection}`);

  // Get all .mdx files
  const allFiles = readdirSync(dirPath);
  const mdxFiles = allFiles
    .filter((file) => file.endsWith(".mdx") || file.endsWith(".md"))
    .map((file) => join(dirPath, file));

  if (mdxFiles.length === 0) {
    console.log(`  No content files found in ${collection}\n`);
    return { processed: 0, skipped: 0, errors: 0 };
  }

  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const filePath of mdxFiles) {
    const filename = filePath.split("/").pop()!;
    const slug = filename.replace(/\.(mdx?|md)$/, "").toLowerCase();

    try {
      // Read file content
      const content = readFileSync(filePath, "utf-8");
      const { data } = parseFrontmatter(content);

      // Check if code exists in frontmatter
      if (!data.code) {
        console.log(`  [SKIP] Skipping ${filename} (no code in frontmatter)`);
        skippedCount++;
        continue;
      }

      const code = data.code;

      // Collect all URL paths: the default slug + any additional slugs from frontmatter
      const defaultPath = `/${collection}/${slug}`;
      const urlPaths: string[] = [defaultPath];

      if (data.slugs && Array.isArray(data.slugs)) {
        for (const customSlug of data.slugs) {
          // Validate that slug starts with / (full path from origin)
          if (!customSlug.startsWith("/")) {
            console.error(
              `  [ERROR] Invalid slug in ${filename}: "${customSlug}" must start with "/"`,
            );
            errorCount++;
            continue;
          }

          // Skip if it's the same as the default path (avoid duplicates)
          if (customSlug !== defaultPath) {
            urlPaths.push(customSlug);
          }
        }
      }

      // Process each URL path
      for (const urlPath of urlPaths) {
        // Check if this slug appears twice in current run
        if (seenSlugsInCurrentRun.has(urlPath)) {
          const previousLocation = seenSlugsInCurrentRun.get(urlPath);
          console.error(
            `  [ERROR] DUPLICATE: ${urlPath} appears in both ${previousLocation} and ${filename}`,
          );
          errorCount++;
          continue;
        }
        seenSlugsInCurrentRun.set(urlPath, filename);

        // Check if this slug is already assigned to a different code
        const existingCode = existingSlugToCode.get(urlPath);
        if (existingCode && existingCode !== code) {
          console.error(
            `  [ERROR] CONFLICT: ${urlPath} is already assigned to code ${existingCode}, cannot reassign to ${code}`,
          );
          errorCount++;
          continue;
        }

        // Skip if already in manifest (idempotent)
        if (manifest.codes[code]?.includes(urlPath)) {
          console.log(`  [SKIP] ${code} -> ${urlPath} (already exists)`);
          processedCount++;
          continue;
        }

        // Add new entry
        if (!manifest.codes[code]) {
          manifest.codes[code] = [];
        }
        manifest.codes[code].push(urlPath);
        existingSlugToCode.set(urlPath, code);

        console.log(`  [OK] ${code} -> ${urlPath}`);
        processedCount++;
      }
    } catch (error) {
      console.error(
        `  [ERROR] Error processing ${filename}:`,
        error instanceof Error ? error.message : error,
      );
      errorCount++;
    }
  }

  console.log();
  return {
    processed: processedCount,
    skipped: skippedCount,
    errors: errorCount,
  };
}

/**
 * Format manifest as YAML string
 */
function formatManifestAsYAML(manifest: UrlManifest): string {
  const lines: string[] = [];

  lines.push(`version: "${manifest.version}"`);
  lines.push("codes:");

  // Sort codes for consistent output
  const sortedCodes = Object.keys(manifest.codes).sort();

  for (const code of sortedCodes) {
    const slugs = manifest.codes[code];
    lines.push(`  ${code}:`);
    for (const slug of slugs) {
      lines.push(`    - ${slug}`);
    }
  }

  return lines.join("\n");
}

/**
 * Load existing manifest if it exists
 */
function loadExistingManifest(): UrlManifest {
  if (!existsSync(MANIFEST_PATH)) {
    return {
      version: "1.0",
      codes: {},
    };
  }

  try {
    const content = readFileSync(MANIFEST_PATH, "utf-8");
    const parsed = YAML.parse(content) as UrlManifest;
    console.log(`Loaded existing manifest with ${Object.keys(parsed.codes).length} codes\n`);
    return parsed;
  } catch (error) {
    console.warn(`[WARN] Failed to load existing manifest, starting fresh:`, error);
    return {
      version: "1.0",
      codes: {},
    };
  }
}

/**
 * Build a reverse mapping of slug -> code for conflict detection
 */
function buildSlugToCodeMap(manifest: UrlManifest): Map<string, string> {
  const slugToCode = new Map<string, string>();
  for (const [code, slugs] of Object.entries(manifest.codes)) {
    for (const slug of slugs) {
      slugToCode.set(slug, code);
    }
  }
  return slugToCode;
}

/**
 * Main function to generate URL manifest
 */
async function genUrlManifest(collections: string[]) {
  console.log(`Content directory: ${CONTENT_DIR}`);
  console.log(`Collections to process: ${collections.join(", ")}`);
  console.log(`Output manifest: ${MANIFEST_PATH}\n`);
  console.log("=".repeat(50) + "\n");

  // Load existing manifest to preserve all entries
  const manifest = loadExistingManifest();
  const existingSlugToCode = buildSlugToCodeMap(manifest);

  // Track slugs seen in the current run to detect duplicates
  const seenSlugsInCurrentRun = new Map<string, string>();

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const collection of collections) {
    let result;
    if (collection === "micro") {
      // Special handling for micro posts from R2
      result = await processMicroCollection(manifest, existingSlugToCode, seenSlugsInCurrentRun);
    } else {
      // File-based collections
      result = processCollection(collection, manifest, existingSlugToCode, seenSlugsInCurrentRun);
    }
    totalProcessed += result.processed;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
  }

  // Exit with error if there were conflicts or errors
  if (totalErrors > 0) {
    console.error("\nManifest generation failed due to errors");
    console.error(`   ${totalErrors} error(s) occurred`);
    process.exit(1);
  }

  // Write manifest to file
  try {
    const header = `# GENERATED FILE - DO NOT EDIT
# This file is automatically generated by scripts/gen-url-manifest.ts
# Run 'mise run gen-url-manifest' to regenerate

`;

    const yamlContent = formatManifestAsYAML(manifest);
    writeFileSync(MANIFEST_PATH, header + yamlContent + "\n");
    console.log("=".repeat(50));
    console.log(`\nManifest written to: ${MANIFEST_PATH}`);
  } catch (error) {
    console.error("Failed to write manifest:", error);
    process.exit(1);
  }

  // Summary
  console.log("\nOverall Summary:");
  console.log(`  Processed: ${totalProcessed}`);
  console.log(`  Skipped:   ${totalSkipped}`);
  console.log(`  Errors:    ${totalErrors}`);
  console.log(`  Total codes: ${Object.keys(manifest.codes).length}`);
}

// Parse command line arguments or use defaults
const collections = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_COLLECTIONS;

// Run the script
try {
  await genUrlManifest(collections);
} catch (error) {
  console.error("Fatal error:", error);
  process.exit(1);
}
