import { describe, it, expect, beforeAll } from "vitest";
import { load } from "js-yaml";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface UrlManifest {
  version: string;
  codes: Record<string, string[]>;
}

describe("URL Manifest", () => {
  let manifest: UrlManifest;
  const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:4321";

  beforeAll(() => {
    // Load the URL manifest
    const manifestPath = resolve(process.cwd(), "src/content/url-manifest.yaml");
    const manifestContent = readFileSync(manifestPath, "utf-8");
    manifest = load(manifestContent) as UrlManifest;
  });

  it("should load the manifest successfully", () => {
    expect(manifest).toBeDefined();
    expect(manifest.version).toBe("1.0");
    expect(manifest.codes).toBeDefined();
  });

  it("should have valid URL entries", () => {
    const codes = Object.keys(manifest.codes);
    expect(codes.length).toBeGreaterThan(0);

    for (const [code, urls] of Object.entries(manifest.codes)) {
      expect(Array.isArray(urls)).toBe(true);
      expect(urls.length).toBeGreaterThan(0);

      for (const url of urls) {
        expect(url).toMatch(/^\//);
      }
    }
  });

  describe("URL resolution", () => {
    it("should resolve all canonical URLs", async () => {
      const allUrls = Object.values(manifest.codes).flat();
      const uniqueUrls = [...new Set(allUrls)];

      const results = await Promise.allSettled(
        uniqueUrls.map(async (url) => {
          const response = await fetch(`${BASE_URL}${url}`, {
            redirect: "manual",
          });

          // Accept 200 (OK) or 3xx redirects
          if (response.status >= 200 && response.status < 400) {
            return { url, status: response.status, success: true };
          }

          throw new Error(`URL ${url} returned status ${response.status}: ${response.statusText}`);
        })
      );

      const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

      if (failed.length > 0) {
        const errors = failed.map((r) => r.reason.message).join("\n");
        throw new Error(`${failed.length} URLs failed to resolve:\n${errors}`);
      }

      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    }, 30000); // 30 second timeout for all URL checks

    it("should resolve all short code URLs", async () => {
      const shortCodes = Object.keys(manifest.codes);

      const results = await Promise.allSettled(
        shortCodes.map(async (code) => {
          const url = `/${code}`;
          const response = await fetch(`${BASE_URL}${url}`, {
            redirect: "manual",
          });

          // Short codes should redirect (3xx) to canonical URLs
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            return { url, status: response.status, location, success: true };
          }

          // Or they might return 200 if middleware handles it internally
          if (response.status === 200) {
            return { url, status: response.status, success: true };
          }

          throw new Error(
            `Short code ${code} returned unexpected status ${response.status}: ${response.statusText}`
          );
        })
      );

      const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

      if (failed.length > 0) {
        const errors = failed.map((r) => r.reason.message).join("\n");
        throw new Error(`${failed.length} short codes failed to resolve:\n${errors}`);
      }

      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    }, 30000);
  });
});
