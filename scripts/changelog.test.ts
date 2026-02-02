import { describe, expect, test } from "bun:test";
import {
  categorizeFiles,
  extractPRNumber,
  parseGitTag,
  groupByDate,
  generateMarkdown,
  type PRData,
  type GroupedEntry,
} from "./changelog";

describe("changelog", () => {
  describe("categorizeFiles", () => {
    test("should categorize deploy package files", () => {
      const files = ["packages/deploy/src/index.ts", "packages/deploy/package.json"];
      expect(categorizeFiles(files)).toBe("@just-be/deploy");
    });

    test("should categorize wildcard package files", () => {
      const files = ["packages/wildcard/src/index.ts", "packages/wildcard/README.md"];
      expect(categorizeFiles(files)).toBe("@just-be/wildcard");
    });

    test("should categorize wildcard service files", () => {
      const files = ["services/wildcard/src/index.ts", "services/wildcard/wrangler.toml"];
      expect(categorizeFiles(files)).toBe("Wildcard Service");
    });

    test("should dynamically categorize new packages", () => {
      // Test that new packages are automatically discovered
      const files = ["packages/auth/src/index.ts", "packages/auth/package.json"];
      expect(categorizeFiles(files)).toBe("@just-be/auth");
    });

    test("should dynamically categorize new services with title case", () => {
      // Test that new services are automatically discovered and title-cased
      const files = ["services/api-gateway/src/index.ts"];
      expect(categorizeFiles(files)).toBe("Api Gateway Service");
    });

    test("should categorize main site files", () => {
      const files = ["src/pages/index.astro", "README.md", "package.json"];
      expect(categorizeFiles(files)).toBe("Main Site");
    });

    test("should categorize by majority when files span multiple categories", () => {
      // 3 deploy files, 1 wildcard file
      const files = [
        "packages/deploy/src/index.ts",
        "packages/deploy/src/cli.ts",
        "packages/deploy/package.json",
        "packages/wildcard/README.md",
      ];
      expect(categorizeFiles(files)).toBe("@just-be/deploy");
    });

    test("should handle empty file list", () => {
      expect(categorizeFiles([])).toBe("Main Site");
    });

    test("should prefer packages over services and main site in ties", () => {
      // 1 deploy, 1 wildcard, 1 service, 1 site - all tied at 1
      const files = [
        "packages/deploy/src/index.ts",
        "packages/wildcard/src/index.ts",
        "services/wildcard/src/index.ts",
        "src/pages/index.astro",
      ];
      // Packages have highest priority in ties
      expect(categorizeFiles(files)).toBe("@just-be/deploy");
    });

    test("should prefer services over main site in ties", () => {
      // 2 service files, 2 main site files
      const files = [
        "services/api-gateway/src/index.ts",
        "services/api-gateway/wrangler.toml",
        "src/pages/index.astro",
        "README.md",
      ];
      // Services have higher priority than Main Site
      expect(categorizeFiles(files)).toBe("Api Gateway Service");
    });

    test("should prefer packages over main site in ties", () => {
      // 2 package files, 2 main site files
      const files = [
        "packages/auth/src/index.ts",
        "packages/auth/package.json",
        "bun.lock",
        "package.json",
      ];
      // Packages have higher priority than Main Site
      expect(categorizeFiles(files)).toBe("@just-be/auth");
    });
  });

  describe("extractPRNumber", () => {
    test("should extract PR number from commit message", () => {
      expect(extractPRNumber("Fix bug in login (#123)")).toBe(123);
      expect(extractPRNumber("Add new feature (#456)")).toBe(456);
      expect(extractPRNumber("Update docs (#1)")).toBe(1);
    });

    test("should handle multi-digit PR numbers", () => {
      expect(extractPRNumber("Large PR (#12345)")).toBe(12345);
    });

    test("should return null for messages without PR number", () => {
      expect(extractPRNumber("Fix bug in login")).toBe(null);
      expect(extractPRNumber("Initial commit")).toBe(null);
      expect(extractPRNumber("WIP")).toBe(null);
    });

    test("should extract first PR number if multiple present", () => {
      expect(extractPRNumber("Merge (#123) and (#456)")).toBe(123);
    });
  });

  describe("parseGitTag", () => {
    test("should parse valid git tag", () => {
      const result = parseGitTag("@just-be/deploy@1.0.0", "abc123");
      expect(result).toEqual({
        tag: "@just-be/deploy@1.0.0",
        commit: "abc123",
        package: "@just-be/deploy",
        version: "1.0.0",
      });
    });

    test("should parse tag with complex version", () => {
      const result = parseGitTag("@just-be/wildcard@2.3.4-beta.1", "def456");
      expect(result).toEqual({
        tag: "@just-be/wildcard@2.3.4-beta.1",
        commit: "def456",
        package: "@just-be/wildcard",
        version: "2.3.4-beta.1",
      });
    });

    test("should return null for invalid tag format", () => {
      expect(parseGitTag("invalid-tag", "abc123")).toBe(null);
      expect(parseGitTag("v1.0.0", "abc123")).toBe(null);
      expect(parseGitTag("@just-be/package", "abc123")).toBe(null);
    });
  });

  describe("groupByDate", () => {
    test("should group PRs by date and category", () => {
      const prs: PRData[] = [
        {
          number: 1,
          title: "Fix deploy bug",
          mergedAt: "2026-02-01",
          files: [],
          category: "@just-be/deploy",
          version: "1.0.0",
        },
        {
          number: 2,
          title: "Update wildcard",
          mergedAt: "2026-02-01",
          files: [],
          category: "@just-be/wildcard",
        },
        {
          number: 3,
          title: "Fix main site",
          mergedAt: "2026-02-02",
          files: [],
          category: "Main Site",
        },
      ];

      const grouped = groupByDate(prs);

      expect(grouped.size).toBe(2);
      expect(grouped.has("2026-02-01")).toBe(true);
      expect(grouped.has("2026-02-02")).toBe(true);

      const feb01 = grouped.get("2026-02-01")!;
      expect(feb01.length).toBe(2);
      expect(feb01[0].category).toBe("@just-be/deploy");
      expect(feb01[0].version).toBe("1.0.0");
      expect(feb01[1].category).toBe("@just-be/wildcard");

      const feb02 = grouped.get("2026-02-02")!;
      expect(feb02.length).toBe(1);
      expect(feb02[0].category).toBe("Main Site");
    });

    test("should sort categories correctly", () => {
      const prs: PRData[] = [
        {
          number: 1,
          title: "Site update",
          mergedAt: "2026-02-01",
          files: [],
          category: "Main Site",
        },
        {
          number: 2,
          title: "Service update",
          mergedAt: "2026-02-01",
          files: [],
          category: "Wildcard Service",
        },
        {
          number: 3,
          title: "Wildcard update",
          mergedAt: "2026-02-01",
          files: [],
          category: "@just-be/wildcard",
        },
        {
          number: 4,
          title: "Deploy update",
          mergedAt: "2026-02-01",
          files: [],
          category: "@just-be/deploy",
        },
      ];

      const grouped = groupByDate(prs);
      const entries = grouped.get("2026-02-01")!;

      // Expected order: packages (alphabetically), services, site
      expect(entries[0].category).toBe("@just-be/deploy");
      expect(entries[1].category).toBe("@just-be/wildcard");
      expect(entries[2].category).toBe("Wildcard Service");
      expect(entries[3].category).toBe("Main Site");
    });

    test("should handle empty PR list", () => {
      const grouped = groupByDate([]);
      expect(grouped.size).toBe(0);
    });
  });

  describe("generateMarkdown", () => {
    test("should generate markdown with versions", () => {
      const grouped = new Map<string, GroupedEntry[]>();
      grouped.set("2026-02-01", [
        {
          category: "@just-be/deploy",
          version: "1.0.0",
          prs: [
            {
              number: 1,
              title: "Fix deploy bug",
              mergedAt: "2026-02-01",
              files: [],
              category: "@just-be/deploy",
            },
          ],
        },
      ]);

      const markdown = generateMarkdown(grouped);

      expect(markdown).toContain("# Changelog");
      expect(markdown).toContain("## 2026-02-01");
      expect(markdown).toContain("### @just-be/deploy - v1.0.0");
      expect(markdown).toContain(
        "- Fix deploy bug ([#1](https://github.com/just-be-dev/just-be.dev/pull/1))"
      );
    });

    test("should generate markdown without versions", () => {
      const grouped = new Map<string, GroupedEntry[]>();
      grouped.set("2026-02-01", [
        {
          category: "Main Site",
          prs: [
            {
              number: 2,
              title: "Update docs",
              mergedAt: "2026-02-01",
              files: [],
              category: "Main Site",
            },
          ],
        },
      ]);

      const markdown = generateMarkdown(grouped);

      expect(markdown).toContain("### Main Site");
      expect(markdown).not.toContain(" - v");
    });

    test("should sort dates in reverse chronological order", () => {
      const grouped = new Map<string, GroupedEntry[]>();
      grouped.set("2026-02-01", [
        {
          category: "Main Site",
          prs: [
            {
              number: 1,
              title: "Old PR",
              mergedAt: "2026-02-01",
              files: [],
              category: "Main Site",
            },
          ],
        },
      ]);
      grouped.set("2026-02-03", [
        {
          category: "Main Site",
          prs: [
            {
              number: 2,
              title: "New PR",
              mergedAt: "2026-02-03",
              files: [],
              category: "Main Site",
            },
          ],
        },
      ]);

      const markdown = generateMarkdown(grouped);
      const firstDateIndex = markdown.indexOf("## 2026-02-03");
      const secondDateIndex = markdown.indexOf("## 2026-02-01");

      expect(firstDateIndex).toBeLessThan(secondDateIndex);
    });

    test("should handle multiple PRs in same category", () => {
      const grouped = new Map<string, GroupedEntry[]>();
      grouped.set("2026-02-01", [
        {
          category: "@just-be/deploy",
          prs: [
            {
              number: 1,
              title: "First PR",
              mergedAt: "2026-02-01",
              files: [],
              category: "@just-be/deploy",
            },
            {
              number: 2,
              title: "Second PR",
              mergedAt: "2026-02-01",
              files: [],
              category: "@just-be/deploy",
            },
          ],
        },
      ]);

      const markdown = generateMarkdown(grouped);

      expect(markdown).toContain("- First PR");
      expect(markdown).toContain("- Second PR");
    });
  });
});
