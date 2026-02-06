#!/usr/bin/env bun

/**
 * Generate release notes for a package version
 *
 * Usage:
 *   bun scripts/release-notes.ts <package-name> <version>
 *   bun scripts/release-notes.ts deploy 0.10.0
 */

import { $ } from "bun";

interface PRDetails {
  number: number;
  title: string;
  files: Array<{ path: string }>;
}

/**
 * Check if any file in the PR touches the specified package
 */
export function touchesPackage(files: Array<{ path: string }>, packageName: string): boolean {
  const packagePath = `packages/${packageName}/`;
  return files.some((file) => file.path.startsWith(packagePath));
}

/**
 * Get GitHub repository from git remote or environment variable
 */
export async function getGitHubRepo(): Promise<string> {
  // Try environment variable first
  if (process.env.GITHUB_REPOSITORY) {
    return process.env.GITHUB_REPOSITORY;
  }

  try {
    // Parse from git remote URL
    const result = await $`git remote get-url origin`.text();
    const url = result.trim();

    // Handle both HTTPS and SSH formats
    // HTTPS: https://github.com/owner/repo.git
    // SSH: git@github.com:owner/repo.git
    const match = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
    if (match) {
      return match[1];
    }
  } catch (error) {
    console.error("Warning: Failed to get GitHub repo from git remote:", error);
  }

  // Fallback to hard-coded value
  return "just-be-dev/just-be.dev";
}

/**
 * Extract PR number from commit message
 * Looks for (#123) pattern
 */
export function extractPRNumber(message: string): number | null {
  const match = message.match(/\(#(\d+)\)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Find the previous git tag for a package before the current version
 */
export async function findPreviousTag(
  packageName: string,
  currentVersion: string
): Promise<string | null> {
  try {
    const fullPackageName = `@just-be/${packageName}`;
    const currentTag = `${fullPackageName}@${currentVersion}`;

    // Get all tags for this package, sorted by version (most recent first)
    const result = await $`git tag --list '${fullPackageName}@*' --sort=-version:refname`.text();
    const tags = result.trim().split("\n").filter(Boolean);

    // Find the tag before the current one
    const currentIndex = tags.indexOf(currentTag);
    if (currentIndex === -1) {
      // Current tag not found, use the most recent tag
      return tags[0] || null;
    }

    // Return the next tag (which is previous chronologically due to reverse sort)
    return tags[currentIndex + 1] || null;
  } catch (error) {
    console.error("Warning: Failed to find previous tag:", error);
    return null;
  }
}

/**
 * Get PR numbers from commits between two refs
 */
export async function getPRNumbersBetweenRefs(
  previousRef: string | null,
  currentRef: string = "HEAD"
): Promise<number[]> {
  try {
    let range: string;
    if (previousRef) {
      range = `${previousRef}..${currentRef}`;
    } else {
      // No previous tag, get all commits
      range = currentRef;
    }

    const result = await $`git log --format='%s' ${range}`.text();
    const messages = result.trim().split("\n").filter(Boolean);

    const prNumbers = messages
      .map((msg) => extractPRNumber(msg))
      .filter((num): num is number => num !== null);

    // Remove duplicates and sort
    return Array.from(new Set(prNumbers)).sort((a, b) => a - b);
  } catch (error) {
    console.error("Warning: Failed to get PR numbers between refs:", error);
    return [];
  }
}

/**
 * Fetch PR details from GitHub
 */
export async function fetchPRDetails(prNumbers: number[]): Promise<PRDetails[]> {
  const details: PRDetails[] = [];

  for (const number of prNumbers) {
    try {
      const result = await $`gh pr view ${number} --json number,title,files`.text();
      const pr = JSON.parse(result);
      details.push({
        number: pr.number,
        title: pr.title,
        files: pr.files || [],
      });
    } catch (error) {
      console.error(`Warning: Failed to fetch details for PR #${number}:`, error);
    }
  }

  return details;
}

/**
 * Generate release notes for a package version
 */
export async function generateReleaseNotes(
  packageName: string,
  version: string,
  githubRepo: string
): Promise<string> {
  // Find the previous tag
  const previousTag = await findPreviousTag(packageName, version);

  // Get PR numbers since the previous tag
  const prNumbers = await getPRNumbersBetweenRefs(previousTag, "HEAD");

  if (prNumbers.length === 0) {
    return `No changes since ${previousTag || "initial release"}.`;
  }

  // Fetch PR details
  const allPRs = await fetchPRDetails(prNumbers);

  // Filter PRs that touch this package
  const relevantPRs = allPRs.filter((pr) => touchesPackage(pr.files, packageName));

  if (relevantPRs.length === 0) {
    return `No changes to this package since ${previousTag || "initial release"}.`;
  }

  // Generate markdown
  const lines: string[] = [];

  if (previousTag) {
    lines.push(`## Changes since ${previousTag}`);
  } else {
    lines.push("## Initial Release");
  }

  lines.push("");

  for (const pr of relevantPRs) {
    lines.push(
      `- ${pr.title} ([#${pr.number}](https://github.com/${githubRepo}/pull/${pr.number}))`
    );
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    `**Full Changelog**: https://github.com/${githubRepo}/compare/${previousTag}...@just-be/${packageName}@${version}`
  );

  return lines.join("\n");
}

/**
 * Main function
 */
export async function main(): Promise<void> {
  const [packageName, version] = process.argv.slice(2);

  if (!packageName || !version) {
    console.error("Usage: bun scripts/release-notes.ts <package-name> <version>");
    console.error("Example: bun scripts/release-notes.ts deploy 0.10.0");
    process.exit(1);
  }

  console.log(`Generating release notes for @just-be/${packageName}@${version}...\n`);

  const githubRepo = await getGitHubRepo();
  const releaseNotes = await generateReleaseNotes(packageName, version, githubRepo);

  console.log(releaseNotes);
}

// Only run if executed directly
if (import.meta.main) {
  await main();
}
