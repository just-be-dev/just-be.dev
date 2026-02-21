#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Code, type Kind } from "../src/utils/code";

const CONTENT_DIR = `${import.meta.dir}/../src/content`;
const DEFAULT_DIRS = ["blog", "games", "research", "projects", "talks"];

/**
 * Infer kind prefix from directory name
 */
function inferKind(dir: string): Kind {
  switch (dir) {
    case "blog":
      return "B";
    case "games":
      return "G";
    case "research":
      return "R";
    case "projects":
      return "P";
    case "talks":
      return "T";
    case "micro":
      return "M";
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
      // Read file content
      const content = readFileSync(filePath, "utf-8");
      const { data } = parseFrontmatter(content);

      // Check if code already exists in frontmatter
      if (data.code) {
        console.log(`⏭  Skipping ${filename} (code already in frontmatter)`);
        skippedCount++;
        continue;
      }

      // Generate code from date
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
      writeFileSync(filePath, updatedContent);

      console.log(`✅ ${filename} (added code ${codeStr} to frontmatter)`);
      processedCount++;
    } catch (error) {
      console.error(
        `❌ Error processing ${filename}:`,
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
    total: mdxFiles.length,
  };
}

/**
 * Main function to generate codes for all content files
 */
function genCodes(dirs: string[]) {
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
  genCodes(dirs);
} catch (error) {
  console.error("Fatal error:", error);
  process.exit(1);
}
