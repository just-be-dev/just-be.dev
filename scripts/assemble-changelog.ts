#!/usr/bin/env bun

/**
 * Assemble changelog fragments into CHANGELOG.md
 *
 * Usage:
 *   bun scripts/assemble-changelog.ts
 */

import { existsSync } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getGitHubRepo } from "./release-notes";

interface FragmentMetadata {
  pr: number;
  title: string;
  category: string;
}

export interface Fragment {
  metadata: FragmentMetadata;
  filePath: string;
}

/**
 * Parse frontmatter from a fragment file
 */
export function parseFrontmatter(content: string): FragmentMetadata | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return null;
  }

  const frontmatter = match[1];
  const lines = frontmatter.split("\n");

  const metadata: any = {};
  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove quotes from string values
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    // Parse PR number as integer
    if (key === "pr") {
      metadata[key] = parseInt(value, 10);
    } else {
      metadata[key] = value;
    }
  }

  return metadata as FragmentMetadata;
}

/**
 * Read all fragment files from .changelog directory
 */
export async function readFragments(): Promise<Fragment[]> {
  const changelogDir = join(import.meta.dir, "../.changelog");

  if (!existsSync(changelogDir)) {
    return [];
  }

  const files = await readdir(changelogDir);
  const fragments: Fragment[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) {
      continue;
    }

    const filePath = join(changelogDir, file);
    const content = await readFile(filePath, "utf-8");
    const metadata = parseFrontmatter(content);

    if (metadata) {
      fragments.push({ metadata, filePath });
    } else {
      console.warn(`Warning: Failed to parse frontmatter in ${file}`);
    }
  }

  return fragments;
}

/**
 * Get category priority for sorting
 */
function getCategoryPriority(category: string): number {
  if (category.startsWith("@just-be/")) return 1; // Packages highest priority
  if (category.endsWith(" Service")) return 2; // Services second
  return 3; // Main Site lowest priority
}

/**
 * Group fragments by category
 */
export function groupFragmentsByCategory(fragments: Fragment[]): Map<string, Fragment[]> {
  const grouped = new Map<string, Fragment[]>();

  for (const fragment of fragments) {
    const category = fragment.metadata.category;
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(fragment);
  }

  // Sort categories: packages (alphabetically), then services, then site
  const sortedEntries = Array.from(grouped.entries()).sort(([a], [b]) => {
    const aPriority = getCategoryPriority(a);
    const bPriority = getCategoryPriority(b);

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Same priority, sort alphabetically
    return a.localeCompare(b);
  });

  return new Map(sortedEntries);
}

/**
 * Generate new changelog entries from fragments
 */
export async function generateNewEntries(fragments: Fragment[]): Promise<string> {
  if (fragments.length === 0) {
    return "";
  }

  const githubRepo = await getGitHubRepo();
  const lines: string[] = [];

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  lines.push(`## ${today}`);
  lines.push("");

  // Group by category
  const grouped = groupFragmentsByCategory(fragments);

  for (const [category, categoryFragments] of grouped) {
    lines.push(`### ${category}`);
    lines.push("");

    // Sort PRs by number
    const sorted = categoryFragments.sort((a, b) => a.metadata.pr - b.metadata.pr);

    for (const fragment of sorted) {
      const { pr, title } = fragment.metadata;
      lines.push(`- ${title} ([#${pr}](https://github.com/${githubRepo}/pull/${pr}))`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Update CHANGELOG.md with new entries
 */
export async function updateChangelog(newEntries: string): Promise<void> {
  const changelogPath = join(import.meta.dir, "../CHANGELOG.md");

  let existingContent = "";
  if (existsSync(changelogPath)) {
    existingContent = await readFile(changelogPath, "utf-8");
  }

  // If the file exists, prepend new entries after the "# Changelog" header
  let updatedContent: string;
  if (existingContent) {
    const lines = existingContent.split("\n");
    const headerIndex = lines.findIndex((line) => line.trim() === "# Changelog");

    if (headerIndex !== -1) {
      // Insert after header
      lines.splice(headerIndex + 1, 0, "", newEntries);
      updatedContent = lines.join("\n");
    } else {
      // No header found, prepend everything
      updatedContent = `# Changelog\n\n${newEntries}\n${existingContent}`;
    }
  } else {
    // New file
    updatedContent = `# Changelog\n\n${newEntries}`;
  }

  await writeFile(changelogPath, updatedContent);
  console.log(`Updated ${changelogPath}`);
}

/**
 * Delete processed fragment files
 */
export async function deleteFragments(fragments: Fragment[]): Promise<void> {
  for (const fragment of fragments) {
    await rm(fragment.filePath);
    console.log(`Deleted ${fragment.filePath}`);
  }
}

/**
 * Main function
 */
export async function main(): Promise<void> {
  console.log("Assembling changelog from fragments...");

  // Read all fragments
  const fragments = await readFragments();

  if (fragments.length === 0) {
    console.log("No fragments found. Nothing to do.");
    return;
  }

  console.log(`Found ${fragments.length} fragment(s)`);

  // Generate new entries
  const newEntries = await generateNewEntries(fragments);

  // Update CHANGELOG.md
  await updateChangelog(newEntries);

  // Delete processed fragments
  await deleteFragments(fragments);

  console.log("\nDone!");
}

// Only run if executed directly
if (import.meta.main) {
  await main();
}
