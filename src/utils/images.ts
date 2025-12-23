import { getEntry } from "astro:content";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const ASSETS_CDN = "https://assets.just-be.dev";

export async function getImageManifest() {
  const manifest = await getEntry("images", "image-manifest");
  return manifest?.data;
}

/**
 * Construct R2 URL from hash and extension
 */
function buildR2Url(hash: string, ext: string): string {
  return `${ASSETS_CDN}/${hash}.${ext}`;
}

/**
 * Download an asset from R2 to local public/assets directory (background, non-blocking)
 * Used during development to incrementally populate local assets.
 *
 * @param url - R2 URL to download from
 * @param localPath - Absolute path to save to
 */
function downloadAssetInBackground(url: string, localPath: string): void {
  // Fire and forget - don't block the build
  fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        console.warn(`[assets] Failed to download ${url}: ${response.status}`);
        return;
      }
      const buffer = await response.arrayBuffer();
      const dir = dirname(localPath);
      mkdirSync(dir, { recursive: true });
      writeFileSync(localPath, Buffer.from(buffer));
      console.log(`[assets] Downloaded ${url} → ${localPath}`);
    })
    .catch((error) => {
      console.warn(`[assets] Download error for ${url}:`, error.message);
    });
}

/**
 * Resolve an image URL with local-first fallback and auto-download
 *
 * Priority:
 * 1. If file exists locally in public/assets/, use /assets/{path}
 * 2. Otherwise, use R2 URL from manifest
 *    - If in dev mode, kick off background download to public/assets/
 * 3. If not in manifest, return null
 *
 * @param path - Path relative to public/assets (e.g., "talks/codegen-in-rust/slide-1.png")
 * @returns URL to use for the image
 */
export async function resolveImageUrl(path: string): Promise<string | null> {
  const localPath = join(process.cwd(), "public/assets", path);

  // Check if file exists locally (for development)
  if (existsSync(localPath)) {
    return `/assets/${path}`;
  }

  // Get metadata from manifest and construct R2 URL
  const manifest = await getImageManifest();
  const metadata = manifest?.images[path];

  if (!metadata) {
    return null;
  }

  const r2Url = buildR2Url(metadata.hash, metadata.ext);

  // In development, download asset in background for next time
  // Check for dev mode: astro dev sets import.meta.env.DEV
  const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV !== "production";
  if (isDev) {
    downloadAssetInBackground(r2Url, localPath);
  }

  // Return R2 URL immediately (don't wait for download)
  return r2Url;
}

export async function getImageMetadata(path: string) {
  const manifest = await getImageManifest();
  return manifest?.images[path] ?? null;
}

/**
 * Resolve slide image URL with local-first fallback
 *
 * @param basePath - Base path (e.g., "/talks/codegen-in-rust" or "talks/codegen-in-rust")
 * @param filename - Filename (e.g., "codegen-1.png")
 * @returns URL to use for the image
 */
export async function resolveSlideImageUrl(
  basePath: string,
  filename: string
): Promise<string | null> {
  const normalizedBase = basePath.startsWith("/") ? basePath.slice(1) : basePath;
  const fullPath = `${normalizedBase}/${filename}`;
  return resolveImageUrl(fullPath);
}
