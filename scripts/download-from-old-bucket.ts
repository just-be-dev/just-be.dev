#!/usr/bin/env bun

/**
 * Download assets from the old R2 bucket using wrangler
 *
 * This script:
 * - Reads the manifest to get hash-based filenames and original paths
 * - Downloads each file from the old bucket using wrangler
 * - Saves them to public/assets with their original paths
 */

import { $ } from "bun";
import { mkdir } from "fs/promises";
import { dirname, join } from "path";

const OLD_BUCKET_NAME = "just-be-dev-assets";
const ASSETS_DIR = join(import.meta.dir, "../public/assets");
const MANIFEST_PATH = join(import.meta.dir, "../src/content/manifest.json");

interface AssetManifest {
  version: string;
  assets: Record<
    string,
    {
      hash: string;
      size: number;
      ext: string;
    }
  >;
}

async function downloadAssets() {
  console.log("Reading manifest...\n");

  const manifestContent = await Bun.file(MANIFEST_PATH).text();
  const manifest: AssetManifest = JSON.parse(manifestContent);

  const assetPaths = Object.keys(manifest.assets);
  console.log(`Found ${assetPaths.length} assets in manifest\n`);

  let downloadCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const assetPath of assetPaths) {
    const { hash, ext } = manifest.assets[assetPath];
    const r2Key = `${hash}.${ext}`;
    const localPath = join(ASSETS_DIR, assetPath);

    // Check if file already exists locally
    const localFile = Bun.file(localPath);
    const exists = await localFile.exists();

    if (exists) {
      console.log(`⏭  ${assetPath} (already exists)`);
      skipCount++;
      continue;
    }

    // Download from old bucket using wrangler
    console.log(`⬇  ${assetPath} <- ${r2Key}`);
    try {
      // Ensure directory exists
      const dir = dirname(localPath);
      await mkdir(dir, { recursive: true });

      // Download using wrangler
      await $`bunx wrangler r2 object get ${OLD_BUCKET_NAME}/${r2Key} --file ${localPath} --remote`;
      downloadCount++;
    } catch (error) {
      console.error(`   Failed: ${error}`);
      failCount++;
    }
  }

  console.log(
    `\nDownloaded: ${downloadCount}, Skipped: ${skipCount}, Failed: ${failCount}, Total: ${assetPaths.length}`
  );

  if (failCount > 0) {
    process.exit(1);
  }
}

downloadAssets().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
