import { getEntry } from "astro:content";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const ASSETS_CDN = "https://assets.just-be.dev";

// Note: No longer need getImageManifest since we use getEntry directly

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
 * Resolve an asset URL with local-first fallback
 *
 * Priority:
 * 1. If file exists locally in public/assets/, use /assets/{path}
 * 2. If in manifest, use /assets/{path} (middleware will proxy to R2)
 *    - If in dev mode, kick off background download to public/assets/
 * 3. If not in manifest, return null
 *
 * @param path - Path relative to public/assets (e.g., "talks/codegen-in-rust/slide-1.png", "talks/codegen-in-rust/audio.m4a")
 * @returns URL to use for the asset
 */
export async function resolveAssetUrl(path: string): Promise<string | null> {
  const localPath = join(process.cwd(), "public/assets", path);

  // Check if file exists locally (for development)
  if (existsSync(localPath)) {
    return `/assets/${path}`;
  }

  // Get metadata from manifest (using path as entry ID)
  const entry = await getEntry("assets", path);
  const metadata = entry?.data;

  if (!metadata) {
    return null;
  }

  // In development, download asset in background for next time
  // Check for dev mode: astro dev sets import.meta.env.DEV
  const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV !== "production";
  if (isDev) {
    const r2Url = buildR2Url(metadata.hash, metadata.ext);
    downloadAssetInBackground(r2Url, localPath);
  }

  // Return /assets/{path} - middleware will proxy to R2 if needed
  return `/assets/${path}`;
}

export async function getAssetMetadata(path: string) {
  const entry = await getEntry("assets", path);
  return entry?.data ?? null;
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
  return resolveAssetUrl(fullPath);
}
