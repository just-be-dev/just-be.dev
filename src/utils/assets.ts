import { existsSync } from "node:fs";
import { join } from "node:path";

const ASSETS_CDN = "https://assets.just-be.dev";

/**
 * Resolve an asset URL with local-first fallback
 *
 * Priority:
 * 1. If file exists locally in public/assets/, use /assets/{path}
 * 2. Otherwise, use CDN URL
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

  // Otherwise use CDN URL with original path (no hashing)
  return `${ASSETS_CDN}/${path}`;
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
  filename: string,
): Promise<string | null> {
  const normalizedBase = basePath.startsWith("/") ? basePath.slice(1) : basePath;
  const fullPath = `${normalizedBase}/${filename}`;
  return resolveAssetUrl(fullPath);
}

/**
 * Get asset metadata - deprecated, returns null
 * @deprecated Assets no longer use content-addressable storage with manifests
 */
export async function getAssetMetadata(_path: string) {
  return null;
}
