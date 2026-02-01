import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  getPackageInfo,
  shouldPublish,
  packPackage,
  findTarball,
  type PackageInfo,
} from "./publish-package";

const TEST_DIR = join(import.meta.dir, "../.test-artifacts/publish-package");

describe("publish-package", () => {
  beforeEach(async () => {
    // Create test directory
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("getPackageInfo", () => {
    test("should read and parse package.json", async () => {
      // Create a test package.json
      const testPackagePath = join(TEST_DIR, "test-package");
      await mkdir(testPackagePath, { recursive: true });
      await Bun.write(
        join(testPackagePath, "package.json"),
        JSON.stringify({
          name: "@test/package",
          version: "1.2.3",
        })
      );

      const info = await getPackageInfo(testPackagePath);

      expect(info).toEqual({
        name: "@test/package",
        version: "1.2.3",
      });
    });

    test("should throw error for invalid package.json", async () => {
      const testPackagePath = join(TEST_DIR, "invalid-package");
      await mkdir(testPackagePath, { recursive: true });
      await Bun.write(
        join(testPackagePath, "package.json"),
        JSON.stringify({
          // Missing required fields
          description: "test",
        })
      );

      await expect(getPackageInfo(testPackagePath)).rejects.toThrow();
    });

    test("should throw error if package.json doesn't exist", async () => {
      const testPackagePath = join(TEST_DIR, "nonexistent-package");

      await expect(getPackageInfo(testPackagePath)).rejects.toThrow();
    });
  });

  describe("shouldPublish", () => {
    test("should return true when versions differ", () => {
      expect(shouldPublish("1.2.3", "1.2.2")).toBe(true);
      expect(shouldPublish("2.0.0", "1.9.9")).toBe(true);
      expect(shouldPublish("1.0.0", "0.0.0")).toBe(true);
    });

    test("should return false when versions are the same", () => {
      expect(shouldPublish("1.2.3", "1.2.3")).toBe(false);
      expect(shouldPublish("0.0.0", "0.0.0")).toBe(false);
    });
  });

  describe("packPackage and findTarball", () => {
    test("should pack a real package and find the tarball", async () => {
      // Use the actual deploy package for testing
      const deployPackagePath = join(import.meta.dir, "../packages/deploy");

      // Pack the package
      await packPackage(deployPackagePath);

      // Find the tarball
      const tarball = await findTarball(deployPackagePath);

      // Verify tarball name format
      expect(tarball).toMatch(/^just-be-deploy-\d+\.\d+\.\d+\.tgz$/);

      // Clean up the tarball
      await rm(join(deployPackagePath, tarball), { force: true });
    });

    test("findTarball should throw error when no tarball exists", async () => {
      const testPackagePath = join(TEST_DIR, "empty-package");
      await mkdir(testPackagePath, { recursive: true });

      await expect(findTarball(testPackagePath)).rejects.toThrow("No tarball found after packing");
    });

    test("findTarball should find tarball when it exists", async () => {
      const testPackagePath = join(TEST_DIR, "tarball-package");
      await mkdir(testPackagePath, { recursive: true });

      // Create a mock tarball
      const tarballName = "test-package-1.0.0.tgz";
      await Bun.write(join(testPackagePath, tarballName), "mock tarball content");

      const foundTarball = await findTarball(testPackagePath);
      expect(foundTarball).toBe(tarballName);
    });
  });
});
