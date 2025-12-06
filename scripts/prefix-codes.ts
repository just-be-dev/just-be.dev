#!/usr/bin/env bun

import { $ } from "bun";
import { Code } from "../src/utils/code";

const CONTENT_DIR = `${import.meta.dir}/../src/content`;
const DEFAULT_DIRS = ["blog", "research"];

/**
 * Extract the date from MDX frontmatter
 */
function extractDate(content: string): string | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[1];
  const dateMatch = frontmatter.match(/^date:\s*(.+)$/m);

  return dateMatch ? dateMatch[1].trim() : null;
}

/**
 * Check if filename already has a code prefix (4 chars followed by --)
 */
function hasCodePrefix(filename: string): boolean {
  return /^[0-9A-Za-z]{4}--/.test(filename);
}

/**
 * Check if filename has an uppercase code prefix
 */
function hasUppercasePrefix(filename: string): boolean {
  return /^[0-9A-Z]{4}--/.test(filename) && /[A-Z]/.test(filename.substring(0, 4));
}

/**
 * Process files in a single directory
 */
async function processDirectory(dir: string) {
  const dirPath = `${CONTENT_DIR}/${dir}`;

  // Check if directory exists
  const exists = await $`test -d ${dirPath}`.nothrow().quiet();
  if (exists.exitCode !== 0) {
    console.log(`⚠️  Directory ${dir} does not exist, skipping...\n`);
    return { processed: 0, skipped: 0, errors: 0, total: 0 };
  }

  console.log(`Processing files in: ${dir}\n`);

  // Get all .mdx files
  const files = await $`ls ${dirPath}/*.mdx 2>/dev/null`.nothrow().quiet();
  if (files.exitCode !== 0) {
    console.log(`No .mdx files found in ${dir}\n`);
    return { processed: 0, skipped: 0, errors: 0, total: 0 };
  }

  const mdxFiles = files.text().trim().split("\n").filter(Boolean);

  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const filePath of mdxFiles) {
    const filename = filePath.split("/").pop()!;

    try {
      // Check if file has uppercase prefix that needs to be converted
      if (hasUppercasePrefix(filename)) {
        const lowercaseFilename = filename.substring(0, 4).toLowerCase() + filename.substring(4);
        const newFilePath = filePath.replace(filename, lowercaseFilename);
        await $`mv ${filePath} ${newFilePath}`;
        console.log(`🔄 ${filename} → ${lowercaseFilename} (converted to lowercase)`);
        processedCount++;
        continue;
      }

      // Skip if already has lowercase code prefix
      if (hasCodePrefix(filename)) {
        console.log(`⏭  Skipping ${filename} (already has code prefix)`);
        skippedCount++;
        continue;
      }

      // Read file content
      const content = await $`cat ${filePath}`.text();

      // Extract date from frontmatter
      const dateString = extractDate(content);
      if (!dateString) {
        console.log(`❌ No date found in ${filename}`);
        errorCount++;
        continue;
      }

      // Generate code from date (lowercase)
      const code = Code.fromDateString(dateString);
      const codeStr = code.toString().toLowerCase();

      // Create new filename
      const newFilename = `${codeStr}--${filename}`;
      const newFilePath = filePath.replace(filename, newFilename);

      // Rename file
      await $`mv ${filePath} ${newFilePath}`;
      console.log(`✅ ${filename} → ${newFilename} (${dateString})`);
      processedCount++;
    } catch (error) {
      console.error(`❌ Error processing ${filename}:`, error instanceof Error ? error.message : error);
      errorCount++;
    }
  }

  console.log();
  return {
    processed: processedCount,
    skipped: skippedCount,
    errors: errorCount,
    total: mdxFiles.length
  };
}

/**
 * Main function to prefix files with their date codes
 */
async function prefixCodes(dirs: string[]) {
  console.log(`Content directory: ${CONTENT_DIR}`);
  console.log(`Directories to process: ${dirs.join(", ")}\n`);
  console.log("=".repeat(50) + "\n");

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalFiles = 0;

  for (const dir of dirs) {
    const result = await processDirectory(dir);
    totalProcessed += result.processed;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
    totalFiles += result.total;
  }

  // Summary
  console.log("=".repeat(50));
  console.log("Overall Summary:");
  console.log(`  Processed: ${totalProcessed}`);
  console.log(`  Skipped:   ${totalSkipped}`);
  console.log(`  Errors:    ${totalErrors}`);
  console.log(`  Total:     ${totalFiles}`);
}

// Parse command line arguments or use defaults
const dirs = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : DEFAULT_DIRS;

// Run the script
prefixCodes(dirs).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
