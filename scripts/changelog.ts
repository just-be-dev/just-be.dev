#!/usr/bin/env bun

/**
 * Shared categorization functions for changelog generation
 *
 * This module contains reusable functions for categorizing PRs by file paths.
 * Used by changelog-entry.ts and other scripts.
 */

/**
 * Convert a name to title case
 */
export function toTitleCase(str: string): string {
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
export function getCategoryFromPath(filePath: string): string {
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
export function getCategoryPriority(category: string): number {
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
