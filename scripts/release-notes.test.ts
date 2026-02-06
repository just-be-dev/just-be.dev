import { describe, expect, test } from "bun:test";
import { touchesPackage, extractPRNumber } from "./release-notes";

describe("release-notes", () => {
  describe("touchesPackage", () => {
    test("should return true if any file touches the package", () => {
      const files = [
        { path: "packages/deploy/src/index.ts" },
        { path: "packages/deploy/package.json" },
      ];
      expect(touchesPackage(files, "deploy")).toBe(true);
    });

    test("should return false if no files touch the package", () => {
      const files = [{ path: "packages/wildcard/src/index.ts" }, { path: "README.md" }];
      expect(touchesPackage(files, "deploy")).toBe(false);
    });

    test("should return true if at least one file touches the package", () => {
      const files = [
        { path: "packages/wildcard/src/index.ts" },
        { path: "packages/deploy/src/cli.ts" },
        { path: "src/pages/index.astro" },
      ];
      expect(touchesPackage(files, "deploy")).toBe(true);
    });

    test("should handle empty file list", () => {
      expect(touchesPackage([], "deploy")).toBe(false);
    });

    test("should handle package names with special characters", () => {
      const files = [{ path: "packages/api-gateway/src/index.ts" }];
      expect(touchesPackage(files, "api-gateway")).toBe(true);
    });

    test("should not match partial package names", () => {
      const files = [{ path: "packages/deploy-helper/src/index.ts" }];
      expect(touchesPackage(files, "deploy")).toBe(false);
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
});
