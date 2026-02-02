import type { Handler, FileLoader, FileObject } from "../types";
import type { StaticConfig } from "../schemas";
import { getContentType, sanitizePath } from "../utils";

export const handleStatic: Handler<StaticConfig, { fileLoader: FileLoader }> = async (
  request,
  config,
  { fileLoader }
) => {
  const url = new URL(request.url);
  const { spa, fallback } = config;

  // Extract subdomain from hostname to use as base path
  // e.g., "foo.just-be.dev" -> "foo"
  const hostname = url.hostname;
  const subdomain = hostname.split(".")[0];
  const basePath = subdomain;

  return spa
    ? handleSpaMode(fileLoader, basePath, url.pathname)
    : handleStaticMode(fileLoader, basePath, url.pathname, fallback);
};

async function handleSpaMode(
  fileLoader: FileLoader,
  basePath: string,
  pathname: string
): Promise<Response> {
  // Sanitize paths to prevent directory traversal
  const sanitizedBase = sanitizePath(basePath);
  const sanitizedPathname = sanitizePath(pathname);

  if (!sanitizedBase || !sanitizedPathname) {
    return new Response("Invalid path", { status: 400 });
  }

  // First, try to serve the requested file if it exists
  // Only check files that likely exist (have extensions or end with /)
  if (pathname !== "/" && (pathname.includes(".") || pathname.endsWith("/"))) {
    const fullPath = `${sanitizedBase}/${sanitizedPathname}`;
    let key = fullPath.replace(/\/+/g, "/"); // Normalize double slashes

    // Append index.html for directories
    if (key.endsWith("/")) {
      key = `${key}index.html`;
    }

    const fileObject = await fileLoader.loadFile(key);

    if (fileObject) {
      return buildFileResponse(fileObject, key);
    }
  }

  // Fall back to index.html for SPA routing
  const indexKey = sanitizedBase.endsWith("index.html")
    ? sanitizedBase
    : sanitizedBase.endsWith("/")
      ? `${sanitizedBase}index.html`
      : `${sanitizedBase}/index.html`;

  const indexFile = await fileLoader.loadFile(indexKey);

  if (!indexFile) {
    return new Response("File not found", { status: 404 });
  }

  return buildFileResponse(indexFile, indexKey);
}

async function handleStaticMode(
  fileLoader: FileLoader,
  basePath: string,
  pathname: string,
  fallback?: string
): Promise<Response> {
  // Sanitize paths to prevent directory traversal
  const sanitizedBase = sanitizePath(basePath);
  const sanitizedPathname = sanitizePath(pathname);

  if (!sanitizedBase || !sanitizedPathname) {
    return new Response("Invalid path", { status: 400 });
  }

  // Standard mode: serve the requested file
  const fullPath = pathname === "/" ? sanitizedBase : `${sanitizedBase}/${sanitizedPathname}`;
  let key = fullPath.replace(/\/+/g, "/"); // Normalize double slashes

  // Append index.html for directories or extensionless paths
  if (key.endsWith("/") || !key.includes(".")) {
    key = key.endsWith("/") ? `${key}index.html` : `${key}/index.html`;
  }

  const fileObject = await fileLoader.loadFile(key);

  if (fileObject) {
    return buildFileResponse(fileObject, key);
  }

  // Try fallback if configured
  if (fallback) {
    const sanitizedFallback = sanitizePath(fallback);
    if (!sanitizedFallback) {
      return new Response("File not found", { status: 404 });
    }

    const fallbackKey = `${sanitizedBase}/${sanitizedFallback}`;
    const fallbackObject = await fileLoader.loadFile(fallbackKey);

    if (fallbackObject) {
      return buildFileResponse(fallbackObject, fallbackKey);
    }
  }

  return new Response("File not found", { status: 404 });
}

function buildFileResponse(fileObject: FileObject, key: string): Response {
  const headers = new Headers(fileObject.headers);

  if (fileObject.etag) {
    headers.set("etag", fileObject.etag);
  }

  if (!headers.has("Content-Type")) {
    const contentType = getContentType(key);
    if (contentType) {
      headers.set("Content-Type", contentType);
    }
  }

  // Security headers
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // Content Security Policy - restrictive default, can be overridden by metadata
  if (!headers.has("Content-Security-Policy")) {
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    );
  }

  // Cache control with Vary header for cache poisoning prevention
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("Vary", "Accept-Encoding");

  return new Response(fileObject.body, { headers });
}
