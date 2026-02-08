#!/usr/bin/env bun

/**
 * Download assets from R2 manifest to local public/assets directory
 * This is a workaround for when R2 bucket is misconfigured
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import manifest from "../src/content/manifest.json";

const ASSETS_CDN = "https://assets.just-be.dev";
const ASSETS_DIR = join(import.meta.dir, "../public/assets");

async function downloadAsset(path: string, hash: string, ext: string) {
  const url = `${ASSETS_CDN}/${hash}.${ext}`;
  const localPath = join(ASSETS_DIR, path);

  console.log(`Downloading ${path}...`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`  ❌ Failed: ${response.status}`);
      return false;
    }

    const buffer = await response.arrayBuffer();

    // Create directory if it doesn't exist
    const dir = dirname(localPath);
    await mkdir(dir, { recursive: true });

    // Write file
    await writeFile(localPath, Buffer.from(buffer));

    console.log(`  ✅ Downloaded (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function main() {
  console.log("Downloading assets from R2...\n");

  let successCount = 0;
  let failCount = 0;

  for (const [path, metadata] of Object.entries(manifest.assets)) {
    const success = await downloadAsset(path, metadata.hash, metadata.ext);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`\n✅ Downloaded: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
