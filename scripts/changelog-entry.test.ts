import { describe, expect, test } from "bun:test";
import { generateFragmentContent } from "./changelog-entry";

describe("changelog-entry", () => {
  describe("generateFragmentContent", () => {
    test("should generate fragment for package PR", () => {
      const pr = {
        number: 211,
        title: "Add preservePath option to redirect handler",
        files: [
          { path: "packages/deploy/src/handlers/redirect.ts" },
          { path: "packages/deploy/src/handlers/redirect.test.ts" },
        ],
      };

      const content = generateFragmentContent(pr);

      expect(content).toContain("pr: 211");
      expect(content).toContain('title: "Add preservePath option to redirect handler"');
      expect(content).toContain('category: "@just-be/deploy"');
      expect(content).toStartWith("---");
      expect(content).toEndWith("---\n");
    });

    test("should generate fragment for service PR", () => {
      const pr = {
        number: 176,
        title: "Add wildcard service for quickly spinning up new apps",
        files: [
          { path: "services/wildcard/src/index.ts" },
          { path: "services/wildcard/wrangler.toml" },
        ],
      };

      const content = generateFragmentContent(pr);

      expect(content).toContain("pr: 176");
      expect(content).toContain('title: "Add wildcard service for quickly spinning up new apps"');
      expect(content).toContain('category: "Wildcard Service"');
    });

    test("should generate fragment for main site PR", () => {
      const pr = {
        number: 100,
        title: "Update homepage design",
        files: [{ path: "src/pages/index.astro" }, { path: "src/layouts/Base.astro" }],
      };

      const content = generateFragmentContent(pr);

      expect(content).toContain("pr: 100");
      expect(content).toContain('title: "Update homepage design"');
      expect(content).toContain('category: "Main Site"');
    });

    test("should handle PR with mixed files using majority vote", () => {
      const pr = {
        number: 200,
        title: "Cross-package refactor",
        files: [
          { path: "packages/deploy/src/index.ts" },
          { path: "packages/deploy/src/cli.ts" },
          { path: "packages/deploy/package.json" },
          { path: "packages/wildcard/README.md" },
        ],
      };

      const content = generateFragmentContent(pr);

      expect(content).toContain('category: "@just-be/deploy"');
    });
  });
});
