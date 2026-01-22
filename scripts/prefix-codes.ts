#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Code, type Kind } from "../src/utils/code";

const CONTENT_DIR = `${import.meta.dir}/../src/content`;
const DEFAULT_DIRS = ["blog", "research", "projects", "talks"];

/**
 * Infer kind prefix from directory name
 */
function inferKind(dir: string): Kind {
  switch (dir) {
    case "blog":
      return "B";
    case "research":
      return "R";
    case "projects":
      return "P";
    case "talks":
      return "T";
    default:
      throw new Error(`Unknown content directory: ${dir}`);
  }
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
  const data = Bun.YAML.parse(yamlStr) as Record<string, any>;

  return { data, body };
}

/**
 * Stringify a YAML value with proper indentation
 */
function stringifyYAMLValue(value: any, indent: number): string[] {
  const lines: string[] = [];
  const indentStr = "  ".repeat(indent);

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "object" && item !== null) {
        lines.push(`${indentStr}-`);
        for (const [k, v] of Object.entries(item)) {
          if (typeof v === "object" && v !== null && !Array.isArray(v)) {
            lines.push(`${indentStr}  ${k}:`);
            lines.push(...stringifyYAMLValue(v, indent + 2));
          } else if (Array.isArray(v)) {
            lines.push(`${indentStr}  ${k}:`);
            lines.push(...stringifyYAMLValue(v, indent + 2));
          } else {
            lines.push(`${indentStr}  ${k}: ${v}`);
          }
        }
      } else {
        lines.push(`${indentStr}- ${item}`);
      }
    }
  } else if (typeof value === "object" && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        lines.push(`${indentStr}${k}:`);
        lines.push(...stringifyYAMLValue(v, indent + 1));
      } else if (Array.isArray(v)) {
        lines.push(`${indentStr}${k}:`);
        lines.push(...stringifyYAMLValue(v, indent + 1));
      } else {
        lines.push(`${indentStr}${k}: ${v}`);
      }
    }
  }

  return lines;
}

/**
 * Stringify frontmatter data into YAML format
 */
function stringifyFrontmatter(data: Record<string, any>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      lines.push(...stringifyYAMLValue(value, 1));
    } else if (typeof value === "object" && value !== null) {
      lines.push(`${key}:`);
      lines.push(...stringifyYAMLValue(value, 1));
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join("\n");
}

/**
 * Extract the date from MDX frontmatter
 */
function extractDate(content: string): string | null {
  const { data } = parseFrontmatter(content);
  return data.date ? String(data.date) : null;
}

/**
 * Update or add the code field in frontmatter
 */
function updateFrontmatterCode(content: string, code: string): string {
  const { data, body } = parseFrontmatter(content);
  data.code = code;

  const frontmatter = stringifyFrontmatter(data);
  return `---\n${frontmatter}\n---\n${body}`;
}

/**
 * Check if filename already has a code prefix (5 chars: kind + hex date followed by --)
 */
function hasCodePrefix(filename: string): boolean {
  return /^[BRPTbrpt][0-9A-Fa-f]{4}--/.test(filename);
}

/**
 * Check if filename has an uppercase code prefix
 */
function hasUppercasePrefix(filename: string): boolean {
  return /^[BRPT][0-9A-F]{4}--/.test(filename) && /[A-F]/.test(filename.substring(1, 5));
}

/**
 * Check if filename has old 4-char base-36 code prefix (needs migration)
 */
function hasOldCodePrefix(filename: string): boolean {
  return /^[0-9A-Za-z]{4}--/.test(filename) && !/^[BRPT][0-9A-Fa-f]{4}--/.test(filename);
}

/**
 * Process files in a single directory
 */
function processDirectory(dir: string) {
  const dirPath = join(CONTENT_DIR, dir);
  const kind = inferKind(dir);

  // Check if directory exists
  if (!existsSync(dirPath)) {
    console.log(`⚠️  Directory ${dir} does not exist, skipping...\n`);
    return { processed: 0, skipped: 0, errors: 0, total: 0 };
  }

  console.log(`Processing files in: ${dir} (kind: ${kind})\n`);

  // Get all .mdx files
  const allFiles = readdirSync(dirPath);
  const mdxFiles = allFiles
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => join(dirPath, file));

  if (mdxFiles.length === 0) {
    console.log(`No .mdx files found in ${dir}\n`);
    return { processed: 0, skipped: 0, errors: 0, total: 0 };
  }

  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const filePath of mdxFiles) {
    const filename = filePath.split("/").pop()!;

    try {
      // Check if file has uppercase prefix that needs to be converted
      if (hasUppercasePrefix(filename)) {
        const lowercaseFilename = filename.substring(0, 5).toLowerCase() + filename.substring(5);
        const newFilePath = filePath.replace(filename, lowercaseFilename);

        // Read content and update frontmatter with code
        const content = readFileSync(filePath, "utf-8");
        const codeStr = lowercaseFilename.substring(0, 5);
        const updatedContent = updateFrontmatterCode(content, codeStr);

        // Write updated content
        writeFileSync(filePath, updatedContent);

        // Rename file
        renameSync(filePath, newFilePath);
        console.log(
          `🔄 ${filename} → ${lowercaseFilename} (converted to lowercase, added code to frontmatter)`
        );
        processedCount++;
        continue;
      }

      // Check if file already has new 5-char code prefix
      if (hasCodePrefix(filename)) {
        // Read content to check if code is in frontmatter
        const content = readFileSync(filePath, "utf-8");
        const codeStr = filename.substring(0, 5);

        // Check if code field already exists in frontmatter
        const { data } = parseFrontmatter(content);
        if (data.code === codeStr) {
          console.log(`⏭  Skipping ${filename} (already has code in filename and frontmatter)`);
          skippedCount++;
          continue;
        }

        // Add code to frontmatter
        const updatedContent = updateFrontmatterCode(content, codeStr);
        writeFileSync(filePath, updatedContent);
        console.log(`✅ ${filename} (added code to frontmatter)`);
        processedCount++;
        continue;
      }

      // Read file content
      const content = readFileSync(filePath, "utf-8");

      // Extract date from frontmatter
      const dateString = extractDate(content);
      if (!dateString) {
        console.log(`❌ No date found in ${filename}`);
        errorCount++;
        continue;
      }

      // Generate code from date with kind prefix (lowercase)
      const code = Code.fromDateString(dateString, kind);
      const codeStr = code.toString().toLowerCase();

      // Update frontmatter with code
      const updatedContent = updateFrontmatterCode(content, codeStr);

      // Determine base filename (strip old code if present)
      let baseFilename = filename;
      if (hasOldCodePrefix(filename)) {
        // Remove old 4-char base-36 code prefix
        baseFilename = filename.substring(6); // Skip "XXXX--"
        console.log(`🔄 Migrating from old base-36 code: ${filename.substring(0, 4)}`);
      }

      // Create new filename
      const newFilename = `${codeStr}--${baseFilename}`;
      const newFilePath = filePath.replace(filename, newFilename);

      // Write updated content
      writeFileSync(filePath, updatedContent);

      // Rename file if needed
      if (filePath !== newFilePath) {
        renameSync(filePath, newFilePath);
      }
      console.log(`✅ ${filename} → ${newFilename} (${dateString})`);
      processedCount++;
    } catch (error) {
      console.error(
        `❌ Error processing ${filename}:`,
        error instanceof Error ? error.message : error
      );
      errorCount++;
    }
  }

  console.log();
  return {
    processed: processedCount,
    skipped: skippedCount,
    errors: errorCount,
    total: mdxFiles.length,
  };
}

/**
 * Main function to prefix files with their date codes
 */
function prefixCodes(dirs: string[]) {
  console.log(`Content directory: ${CONTENT_DIR}`);
  console.log(`Directories to process: ${dirs.join(", ")}\n`);
  console.log("=".repeat(50) + "\n");

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalFiles = 0;

  for (const dir of dirs) {
    const result = processDirectory(dir);
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
const dirs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_DIRS;

// Run the script
try {
  prefixCodes(dirs);
} catch (error) {
  console.error("Fatal error:", error);
  process.exit(1);
}
