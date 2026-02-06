import { describe, expect, test } from "bun:test";
import {
  parseFrontmatter,
  groupFragmentsByCategory,
  generateNewEntries,
} from "./assemble-changelog";
import type { Fragment } from "./assemble-changelog";

describe("assemble-changelog", () => {
  describe("parseFrontmatter", () => {
    test("should parse valid frontmatter", () => {
      const content = `---
pr: 211
title: "Add preservePath option"
category: "@just-be/deploy"
---`;

      const metadata = parseFrontmatter(content);

      expect(metadata).toEqual({
        pr: 211,
        title: "Add preservePath option",
        category: "@just-be/deploy",
      });
    });

    test("should handle frontmatter without quotes", () => {
      const content = `---
pr: 123
title: Simple title
category: Main Site
---`;

      const metadata = parseFrontmatter(content);

      expect(metadata).toEqual({
        pr: 123,
        title: "Simple title",
        category: "Main Site",
      });
    });

    test("should return null for invalid frontmatter", () => {
      const content = "No frontmatter here";
      expect(parseFrontmatter(content)).toBe(null);
    });

    test("should return null for empty content", () => {
      expect(parseFrontmatter("")).toBe(null);
    });
  });

  describe("groupFragmentsByCategory", () => {
    test("should group fragments by category with correct priority", () => {
      const fragments: Fragment[] = [
        {
          metadata: { pr: 1, title: "Site update", category: "Main Site" },
          filePath: "1.md",
        },
        {
          metadata: { pr: 2, title: "Service update", category: "Wildcard Service" },
          filePath: "2.md",
        },
        {
          metadata: { pr: 3, title: "Deploy update", category: "@just-be/deploy" },
          filePath: "3.md",
        },
        {
          metadata: { pr: 4, title: "Wildcard update", category: "@just-be/wildcard" },
          filePath: "4.md",
        },
      ];

      const grouped = groupFragmentsByCategory(fragments);
      const categories = Array.from(grouped.keys());

      // Expected order: packages (alphabetically), services, site
      expect(categories).toEqual([
        "@just-be/deploy",
        "@just-be/wildcard",
        "Wildcard Service",
        "Main Site",
      ]);
    });

    test("should handle single category", () => {
      const fragments: Fragment[] = [
        {
          metadata: { pr: 1, title: "Update 1", category: "@just-be/deploy" },
          filePath: "1.md",
        },
        {
          metadata: { pr: 2, title: "Update 2", category: "@just-be/deploy" },
          filePath: "2.md",
        },
      ];

      const grouped = groupFragmentsByCategory(fragments);

      expect(grouped.size).toBe(1);
      expect(grouped.get("@just-be/deploy")).toHaveLength(2);
    });

    test("should handle empty fragment list", () => {
      const grouped = groupFragmentsByCategory([]);
      expect(grouped.size).toBe(0);
    });
  });

  describe("generateNewEntries", () => {
    test("should generate entries with correct format", async () => {
      const fragments: Fragment[] = [
        {
          metadata: {
            pr: 211,
            title: "Add preservePath option",
            category: "@just-be/deploy",
          },
          filePath: "211.md",
        },
        {
          metadata: { pr: 100, title: "Update docs", category: "Main Site" },
          filePath: "100.md",
        },
      ];

      const entries = await generateNewEntries(fragments);

      // Should contain date heading
      expect(entries).toMatch(/## \d{4}-\d{2}-\d{2}/);

      // Should contain category headings
      expect(entries).toContain("### @just-be/deploy");
      expect(entries).toContain("### Main Site");

      // Should contain PR entries
      expect(entries).toContain("- Add preservePath option ([#211]");
      expect(entries).toContain("- Update docs ([#100]");
    });

    test("should return empty string for empty fragment list", async () => {
      const entries = await generateNewEntries([]);
      expect(entries).toBe("");
    });

    test("should sort PRs by number within category", async () => {
      const fragments: Fragment[] = [
        {
          metadata: { pr: 300, title: "Third", category: "@just-be/deploy" },
          filePath: "300.md",
        },
        {
          metadata: { pr: 100, title: "First", category: "@just-be/deploy" },
          filePath: "100.md",
        },
        {
          metadata: { pr: 200, title: "Second", category: "@just-be/deploy" },
          filePath: "200.md",
        },
      ];

      const entries = await generateNewEntries(fragments);
      const lines = entries.split("\n");

      // Find the lines with PR entries
      const prLines = lines.filter((line) => line.includes("([#"));

      // Check order
      expect(prLines[0]).toContain("#100");
      expect(prLines[1]).toContain("#200");
      expect(prLines[2]).toContain("#300");
    });
  });
});
