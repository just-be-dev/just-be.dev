import { describe, expect, test } from "bun:test";
import {
  categorizeFiles,
  getCategoryFromPath,
  getCategoryPriority,
  toTitleCase,
} from "./changelog";

describe("changelog", () => {
  describe("toTitleCase", () => {
    test("should convert single word to title case", () => {
      expect(toTitleCase("wildcard")).toBe("Wildcard");
    });

    test("should convert multi-word hyphenated names to title case", () => {
      expect(toTitleCase("api-gateway")).toBe("Api Gateway");
      expect(toTitleCase("some-long-service-name")).toBe("Some Long Service Name");
    });
  });

  describe("getCategoryFromPath", () => {
    test("should categorize package files", () => {
      expect(getCategoryFromPath("packages/deploy/src/index.ts")).toBe("@just-be/deploy");
      expect(getCategoryFromPath("packages/wildcard/package.json")).toBe("@just-be/wildcard");
    });

    test("should categorize service files", () => {
      expect(getCategoryFromPath("services/wildcard/src/index.ts")).toBe("Wildcard Service");
      expect(getCategoryFromPath("services/api-gateway/wrangler.toml")).toBe("Api Gateway Service");
    });

    test("should categorize main site files", () => {
      expect(getCategoryFromPath("src/pages/index.astro")).toBe("Main Site");
      expect(getCategoryFromPath("README.md")).toBe("Main Site");
      expect(getCategoryFromPath("package.json")).toBe("Main Site");
    });
  });

  describe("getCategoryPriority", () => {
    test("should return priority 1 for packages", () => {
      expect(getCategoryPriority("@just-be/deploy")).toBe(1);
      expect(getCategoryPriority("@just-be/wildcard")).toBe(1);
    });

    test("should return priority 2 for services", () => {
      expect(getCategoryPriority("Wildcard Service")).toBe(2);
      expect(getCategoryPriority("Api Gateway Service")).toBe(2);
    });

    test("should return priority 3 for main site", () => {
      expect(getCategoryPriority("Main Site")).toBe(3);
    });
  });

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
      const files = ["packages/auth/src/index.ts", "packages/auth/package.json"];
      expect(categorizeFiles(files)).toBe("@just-be/auth");
    });

    test("should dynamically categorize new services with title case", () => {
      const files = ["services/api-gateway/src/index.ts"];
      expect(categorizeFiles(files)).toBe("Api Gateway Service");
    });

    test("should categorize main site files", () => {
      const files = ["src/pages/index.astro", "README.md", "package.json"];
      expect(categorizeFiles(files)).toBe("Main Site");
    });

    test("should categorize by majority when files span multiple categories", () => {
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
      const files = [
        "packages/deploy/src/index.ts",
        "packages/wildcard/src/index.ts",
        "services/wildcard/src/index.ts",
        "src/pages/index.astro",
      ];
      expect(categorizeFiles(files)).toBe("@just-be/deploy");
    });

    test("should prefer services over main site in ties", () => {
      const files = [
        "services/api-gateway/src/index.ts",
        "services/api-gateway/wrangler.toml",
        "src/pages/index.astro",
        "README.md",
      ];
      expect(categorizeFiles(files)).toBe("Api Gateway Service");
    });

    test("should prefer packages over main site in ties", () => {
      const files = [
        "packages/auth/src/index.ts",
        "packages/auth/package.json",
        "bun.lock",
        "package.json",
      ];
      expect(categorizeFiles(files)).toBe("@just-be/auth");
    });
  });
});
