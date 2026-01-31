import type { Env, Handler } from "../types";
import type { R2Config } from "../schemas";
import { getContentType, sanitizePath } from "../utils";

export const handleR2: Handler<R2Config> = async (request, env, config) => {
  const url = new URL(request.url);
  const { path: basePath, spa, fallback } = config;

  return spa
    ? handleSpaMode(env, basePath)
    : handleStaticMode(env, basePath, url.pathname, fallback);
};

async function handleSpaMode(env: Env, basePath: string): Promise<Response> {
  // Sanitize base path to prevent directory traversal
  const sanitizedBase = sanitizePath(basePath);
  if (!sanitizedBase) {
    return new Response("Invalid path", { status: 400 });
  }

  const key = sanitizedBase.endsWith("index.html")
    ? sanitizedBase
    : sanitizedBase.endsWith("/")
      ? `${sanitizedBase}index.html`
      : `${sanitizedBase}/index.html`;

  const object = await env.CONTENT_BUCKET.get(key);

  if (!object) {
    return new Response("File not found", { status: 404 });
  }

  return buildR2Response(object, key);
}

async function handleStaticMode(
  env: Env,
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

  const object = await env.CONTENT_BUCKET.get(key);

  if (object) {
    return buildR2Response(object, key);
  }

  // Try fallback if configured
  if (fallback) {
    const sanitizedFallback = sanitizePath(fallback);
    if (!sanitizedFallback) {
      return new Response("File not found", { status: 404 });
    }

    const fallbackKey = `${sanitizedBase}/${sanitizedFallback}`;
    const fallbackObject = await env.CONTENT_BUCKET.get(fallbackKey);

    if (fallbackObject) {
      return buildR2Response(fallbackObject, fallbackKey);
    }
  }

  return new Response("File not found", { status: 404 });
}

function buildR2Response(object: R2ObjectBody, key: string): Response {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

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

  // Content Security Policy - restrictive default, can be overridden by R2 object metadata
  if (!headers.has("Content-Security-Policy")) {
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    );
  }

  // Cache control with Vary header for cache poisoning prevention
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("Vary", "Accept-Encoding");

  return new Response(object.body, { headers });
}
