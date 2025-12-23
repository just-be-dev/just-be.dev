#!/usr/bin/env bun

/**
 * Upload images from public/assets to Cloudflare R2
 *
 * This script:
 * - Scans public/assets for images (png, jpg, jpeg, webp, gif, svg)
 * - Generates SHA-256 hash for each image
 * - Uploads to R2 with content-addressable key (hash.ext)
 * - Creates manifest mapping original paths to R2 URLs
 * - Skips uploads for images already in R2 (idempotent)
 *
 * Path structure:
 * - Local: public/assets/talks/codegen-in-rust/slide-1.png
 * - Manifest key: talks/codegen-in-rust/slide-1.png (relative to public/assets)
 * - R2 key: a3f2c1d4e5...f6.png (content hash)
 * - R2 URL: https://assets.just-be.dev/a3f2c1d4e5...f6.png
 *
 * Build-time resolution (src/utils/images.ts):
 * 1. Check if file exists locally → use /assets/{path}
 * 2. Otherwise, use R2 URL from manifest
 * This allows dev with local files, but falls back to R2 if files aren't present.
 */

import { $ } from "bun";
import { createHash } from "crypto";
import { readdir, readFile, writeFile } from "fs/promises";
import { join, relative } from "path";

const BUCKET_NAME = "just-be-dev-assets";
const CUSTOM_DOMAIN = "https://assets.just-be.dev";
const IMAGE_DIR = join(import.meta.dir, "../public/assets");
const MANIFEST_PATH = join(import.meta.dir, "../src/content/image-manifest.json");

interface ImageManifest {
  version: string;
  generatedAt: string;
  images: Record<string, {
    hash: string;
    size: number;
    ext: string;
  }>;
}

async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function findImages(dir: string): Promise<string[]> {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
  const results: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = entry.name.toLowerCase().slice(entry.name.lastIndexOf('.'));
        if (imageExtensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  await walk(dir);
  return results;
}

async function checkR2Exists(key: string): Promise<boolean> {
  // Check if object exists via HTTP HEAD request to the CDN URL
  try {
    const response = await fetch(`${CUSTOM_DOMAIN}/${key}`, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

async function uploadToR2(localPath: string, key: string): Promise<void> {
  await $`wrangler r2 object put ${BUCKET_NAME}/${key} --file ${localPath} --remote`;
}

async function uploadImages() {
  console.log(`Scanning images in: ${IMAGE_DIR}\n`);

  const imagePaths = await findImages(IMAGE_DIR);
  console.log(`Found ${imagePaths.length} images\n`);

  const manifest: ImageManifest = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    images: {},
  };

  let uploadCount = 0;
  let skipCount = 0;

  for (const imagePath of imagePaths) {
    const hash = await hashFile(imagePath);
    const ext = imagePath.split(".").pop()!;
    const key = `${hash}.${ext}`;

    // Store path relative to public/assets (e.g., "talks/codegen-in-rust/slide-1.png")
    const originalPath = relative(join(import.meta.dir, "../public/assets"), imagePath);

    const exists = await checkR2Exists(key);

    if (exists) {
      console.log(`⏭  ${originalPath} → ${key} (already exists)`);
      skipCount++;
    } else {
      console.log(`⬆  ${originalPath} → ${key}`);
      await uploadToR2(imagePath, key);
      uploadCount++;
    }

    const stats = await Bun.file(imagePath).stat();
    manifest.images[originalPath] = {
      hash,
      size: stats.size,
      ext,
    };
  }

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\n✅ Manifest written to ${MANIFEST_PATH}`);
  console.log(`\nUploaded: ${uploadCount}, Skipped: ${skipCount}, Total: ${imagePaths.length}`);
}

uploadImages().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
