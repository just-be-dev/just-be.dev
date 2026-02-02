#!/usr/bin/env bun

/**
 * Generate and maintain changelog from GitHub PRs
 *
 * Usage:
 *   bun scripts/changelog.ts              # Generate/update changelog
 *   bun scripts/changelog.ts --dry-run    # Preview changes without writing
 *   bun scripts/changelog.ts --since=60   # Get PRs from last 60 days
 */

import { $ } from "bun";
import { writeFileSync } from "node:fs";

const CHANGELOG_PATH = `${import.meta.dir}/../CHANGELOG.md`;

export interface PRData {
  number: number;
  title: string;
  mergedAt: string;
  files: Array<{ path: string }>;
  category: string;
  version?: string;
}

export interface GitTag {
  tag: string;
  commit: string;
  package: string;
  version: string;
}

export interface GroupedEntry {
  category: string;
  prs: PRData[];
  version?: string;
}

/**
 * Convert a name to title case
 */
function toTitleCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Extract category from file path
 * - packages/{name}/ -> @just-be/{name}
 * - services/{name}/ -> {Name} Service (title case)
 * - Everything else -> Main Site
 */
function getCategoryFromPath(filePath: string): string {
  const packageMatch = filePath.match(/^packages\/([^/]+)\//);
  if (packageMatch) {
    return `@just-be/${packageMatch[1]}`;
  }

  const serviceMatch = filePath.match(/^services\/([^/]+)\//);
  if (serviceMatch) {
    return `${toTitleCase(serviceMatch[1])} Service`;
  }

  return "Main Site";
}

/**
 * Get priority for a category (lower is higher priority)
 * Used for tie-breaking when multiple categories have the same file count
 */
function getCategoryPriority(category: string): number {
  if (category.startsWith("@just-be/")) return 1; // Packages highest priority
  if (category.endsWith(" Service")) return 2; // Services second
  return 3; // Main Site lowest priority
}

/**
 * Categorize a PR based on files changed
 * Counts files in each category and picks the one with the most files
 * In case of a tie, prefers packages > services > main site
 */
export function categorizeFiles(files: string[]): string {
  const categories = new Map<string, number>();

  for (const file of files) {
    const category = getCategoryFromPath(file);
    categories.set(category, (categories.get(category) || 0) + 1);
  }

  // Find category with most files (with priority-based tie-breaking)
  let maxCount = 0;
  let selectedCategory = "Main Site";
  let selectedPriority = getCategoryPriority("Main Site");

  for (const [category, count] of categories) {
    const priority = getCategoryPriority(category);

    if (count > maxCount || (count === maxCount && priority < selectedPriority)) {
      maxCount = count;
      selectedCategory = category;
      selectedPriority = priority;
    }
  }

  return selectedCategory;
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
 * Parse git tag in format @just-be/<package>@<version>
 */
export function parseGitTag(tag: string, commit: string): GitTag | null {
  const match = tag.match(/^@just-be\/([^@]+)@(.+)$/);
  if (!match) return null;

  return {
    tag,
    commit,
    package: `@just-be/${match[1]}`,
    version: match[2],
  };
}

/**
 * Fetch merged PRs from GitHub
 */
export async function fetchPRs(since: string = "30 days ago"): Promise<PRData[]> {
  try {
    // Calculate date for --search parameter
    const sinceDate = new Date();
    const daysMatch = since.match(/(\d+)\s*days?/);
    if (daysMatch) {
      sinceDate.setDate(sinceDate.getDate() - parseInt(daysMatch[1], 10));
    }
    const searchDate = sinceDate.toISOString().split("T")[0];

    // Use --limit 1000 to handle repos with high PR volume
    // The date search constraint is the primary filter
    const result =
      await $`gh pr list --state merged --limit 1000 --search "merged:>=${searchDate}" --json number,title,mergedAt,files`.text();
    const prs = JSON.parse(result);

    return prs.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      mergedAt: pr.mergedAt.split("T")[0], // Extract date part
      files: pr.files || [],
      category: categorizeFiles(pr.files?.map((f: any) => f.path) || []),
    }));
  } catch (error) {
    console.error("❌ Failed to fetch PRs from GitHub:", error);
    throw error;
  }
}

/**
 * Fetch git tags for version information
 */
export async function fetchGitTags(): Promise<GitTag[]> {
  try {
    const result =
      await $`git tag --list '@just-be/*@*' --format='%(refname:short)|%(objectname)'`.text();
    const lines = result.trim().split("\n").filter(Boolean);

    const tags: GitTag[] = [];
    for (const line of lines) {
      const [tag, commit] = line.split("|");
      const parsed = parseGitTag(tag, commit);
      if (parsed) {
        tags.push(parsed);
      }
    }

    return tags;
  } catch (error) {
    console.error("❌ Failed to fetch git tags:", error);
    return [];
  }
}

/**
 * Map PR numbers to their commit SHAs
 */
export async function mapPRsToCommits(): Promise<Map<number, string>> {
  const prToCommit = new Map<number, string>();

  try {
    // Get git log with commit hashes and messages (using null byte separator)
    // Target origin/main instead of --all for better performance
    const result = await $`git log --format='%H%x00%s%x00' origin/main`.text();
    const entries = result.trim().split("\x00\x00").filter(Boolean);

    for (const entry of entries) {
      const [commit, message] = entry.split("\x00");
      if (commit && message) {
        const prNumber = extractPRNumber(message);
        if (prNumber && !prToCommit.has(prNumber)) {
          prToCommit.set(prNumber, commit);
        }
      }
    }
  } catch (error) {
    console.error("⚠️  Warning: Failed to map PRs to commits:", error);
  }

  return prToCommit;
}

/**
 * Associate package versions with PRs based on git tags
 */
export async function associateVersions(prs: PRData[], tags: GitTag[]): Promise<PRData[]> {
  // Map PR numbers to their commit SHAs
  const prToCommit = await mapPRsToCommits();

  // Map commits to tags
  const commitToTag = new Map<string, GitTag>();
  for (const tag of tags) {
    commitToTag.set(tag.commit, tag);
  }

  // Associate versions with PRs
  for (const pr of prs) {
    const commit = prToCommit.get(pr.number);
    if (commit) {
      const tag = commitToTag.get(commit);
      if (tag && tag.package === pr.category) {
        pr.version = tag.version;
      }
    }
  }

  return prs;
}

/**
 * Group PRs by date
 */
export function groupByDate(prs: PRData[]): Map<string, GroupedEntry[]> {
  const grouped = new Map<string, Map<string, PRData[]>>();

  // First group by date, then by category
  for (const pr of prs) {
    if (!grouped.has(pr.mergedAt)) {
      grouped.set(pr.mergedAt, new Map());
    }
    const dateGroup = grouped.get(pr.mergedAt)!;

    if (!dateGroup.has(pr.category)) {
      dateGroup.set(pr.category, []);
    }
    dateGroup.get(pr.category)!.push(pr);
  }

  // Convert to final structure with sorting
  const result = new Map<string, GroupedEntry[]>();

  for (const [date, categoryMap] of grouped) {
    const entries: GroupedEntry[] = [];

    // Sort categories: packages first (alphabetically), then services, then site
    const sortedCategories = Array.from(categoryMap.keys()).sort((a, b) => {
      const aIsPackage = a.startsWith("@just-be/");
      const bIsPackage = b.startsWith("@just-be/");
      const aIsService = a.includes("Service");
      const bIsService = b.includes("Service");

      if (aIsPackage && !bIsPackage) return -1;
      if (!aIsPackage && bIsPackage) return 1;
      if (aIsPackage && bIsPackage) return a.localeCompare(b);
      if (aIsService && !bIsService) return -1;
      if (!aIsService && bIsService) return 1;
      return a.localeCompare(b);
    });

    for (const category of sortedCategories) {
      const categoryPRs = categoryMap.get(category)!;

      // Find the most recent version for this category on this date
      const version = categoryPRs.find((pr) => pr.version)?.version;

      entries.push({
        category,
        prs: categoryPRs,
        version,
      });
    }

    result.set(date, entries);
  }

  return result;
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
    console.error("⚠️  Warning: Failed to get GitHub repo from git remote:", error);
  }

  // Fallback to hard-coded value
  return "just-be-dev/just-be.dev";
}

/**
 * Generate markdown from grouped PRs
 */
export function generateMarkdown(grouped: Map<string, GroupedEntry[]>, githubRepo: string): string {
  const lines: string[] = [];

  lines.push("# Changelog");
  lines.push("");

  // Sort dates in reverse chronological order (newest first)
  const sortedDates = Array.from(grouped.keys()).sort().reverse();

  for (const date of sortedDates) {
    const entries = grouped.get(date)!;

    lines.push(`## ${date}`);
    lines.push("");

    for (const entry of entries) {
      // Add category header with version if available
      if (entry.version) {
        lines.push(`### ${entry.category} - v${entry.version}`);
      } else {
        lines.push(`### ${entry.category}`);
      }

      // Add PRs
      for (const pr of entry.prs) {
        lines.push(
          `- ${pr.title} ([#${pr.number}](https://github.com/${githubRepo}/pull/${pr.number}))`
        );
      }

      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Update CHANGELOG.md file
 */
export async function updateChangelog(markdown: string): Promise<void> {
  try {
    writeFileSync(CHANGELOG_PATH, markdown);
    console.log(`✅ Changelog written to: ${CHANGELOG_PATH}`);
  } catch (error) {
    console.error("❌ Failed to write changelog:", error);
    throw error;
  }
}

/**
 * Main function
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  // Parse --since flag
  let since = "30 days ago";
  const sinceArg = args.find((a) => a.startsWith("--since="));
  if (sinceArg) {
    const value = sinceArg.split("=")[1];
    since = `${value} days ago`;
  }

  console.log("📋 Generating changelog...");
  console.log(`   Time range: ${since}`);
  console.log("");

  // 1. Fetch PRs
  console.log("🔍 Fetching merged PRs from GitHub...");
  const prs = await fetchPRs(since);
  console.log(`   Found ${prs.length} merged PRs\n`);

  if (prs.length === 0) {
    console.log("⚠️  No PRs found in the specified time range");
    return;
  }

  // 2. Fetch git tags for versions
  console.log("🏷️  Fetching git tags...");
  const tags = await fetchGitTags();
  console.log(`   Found ${tags.length} package tags\n`);

  // 3. Associate versions with PRs
  console.log("🔗 Associating versions with PRs...");
  const categorized = await associateVersions(prs, tags);
  console.log(`   Associated versions for package releases\n`);

  // 4. Group by date
  console.log("📅 Grouping by date and category...");
  const grouped = groupByDate(categorized);
  console.log(`   Grouped into ${grouped.size} dates\n`);

  // 5. Get GitHub repository info
  console.log("🔍 Getting GitHub repository...");
  const githubRepo = await getGitHubRepo();
  console.log(`   Using repository: ${githubRepo}\n`);

  // 6. Generate markdown
  console.log("📝 Generating markdown...");
  const markdown = generateMarkdown(grouped, githubRepo);
  console.log("");

  // 7. Update or preview
  if (dryRun) {
    console.log("=".repeat(50));
    console.log("DRY RUN - Preview:");
    console.log("=".repeat(50));
    console.log(markdown);
  } else {
    await updateChangelog(markdown);
    console.log("\n✨ Changelog generated successfully!");
  }
}

// Only run if executed directly
if (import.meta.main) {
  await main();
}
