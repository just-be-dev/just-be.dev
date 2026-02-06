#!/usr/bin/env bun

/**
 * Generate a changelog fragment for a single PR
 *
 * Usage:
 *   bun scripts/changelog-entry.ts <pr-number>
 *   bun scripts/changelog-entry.ts 211
 */

import { $ } from "bun";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { categorizeFiles } from "./changelog";

interface PRMetadata {
  number: number;
  title: string;
  files: Array<{ path: string }>;
}

/**
 * Fetch PR metadata from GitHub
 */
export async function fetchPRMetadata(prNumber: number): Promise<PRMetadata> {
  try {
    const result = await $`gh pr view ${prNumber} --json number,title,files`.text();
    const pr = JSON.parse(result);

    return {
      number: pr.number,
      title: pr.title,
      files: pr.files || [],
    };
  } catch (error) {
    console.error(`Failed to fetch PR #${prNumber} metadata:`, error);
    throw error;
  }
}

/**
 * Generate changelog fragment content
 */
export function generateFragmentContent(pr: PRMetadata): string {
  const filePaths = pr.files.map((f) => f.path);
  const category = categorizeFiles(filePaths);

  const lines: string[] = [];
  lines.push("---");
  lines.push(`pr: ${pr.number}`);
  lines.push(`title: "${pr.title}"`);
  lines.push(`category: "${category}"`);
  lines.push("---");

  return lines.join("\n") + "\n";
}

/**
 * Write changelog fragment to file
 */
export async function writeFragment(prNumber: number, content: string): Promise<void> {
  const changelogDir = join(import.meta.dir, "../.changelog");
  const fragmentPath = join(changelogDir, `${prNumber}.md`);

  // Ensure .changelog directory exists
  if (!existsSync(changelogDir)) {
    await mkdir(changelogDir, { recursive: true });
  }

  // Check if file already exists with matching content
  if (existsSync(fragmentPath)) {
    const existingContent = await Bun.file(fragmentPath).text();
    if (existingContent === content) {
      console.log(`Fragment already exists with matching content: ${fragmentPath}`);
      return;
    }
  }

  // Write the fragment
  await Bun.write(fragmentPath, content);
  console.log(`Created changelog fragment: ${fragmentPath}`);
}

/**
 * Main function
 */
export async function main(): Promise<void> {
  const [prNumberArg] = process.argv.slice(2);

  if (!prNumberArg) {
    console.error("Usage: bun scripts/changelog-entry.ts <pr-number>");
    console.error("Example: bun scripts/changelog-entry.ts 211");
    process.exit(1);
  }

  const prNumber = parseInt(prNumberArg, 10);
  if (isNaN(prNumber)) {
    console.error(`Invalid PR number: ${prNumberArg}`);
    process.exit(1);
  }

  console.log(`Generating changelog fragment for PR #${prNumber}...`);

  // Fetch PR metadata
  const pr = await fetchPRMetadata(prNumber);

  // Generate fragment content
  const content = generateFragmentContent(pr);

  // Write fragment to file
  await writeFragment(prNumber, content);

  console.log("Done!");
}

// Only run if executed directly
if (import.meta.main) {
  await main();
}
