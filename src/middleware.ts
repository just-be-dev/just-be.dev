import { defineMiddleware } from "astro:middleware";
import { getCollection, getEntry } from "astro:content";

const ASSETS_CDN = "https://assets.just-be.dev";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const pathSegments = url.pathname.split("/").filter(Boolean);

  // Proxy /assets/* requests to R2 CDN to avoid CORS issues
  if (pathSegments[0] === "assets") {
    // Extract path relative to /assets/
    const assetPath = pathSegments.slice(1).join("/");

    // Try to get asset metadata from manifest
    const entry = await getEntry("assets", assetPath);

    if (entry?.data) {
      // Build R2 URL from hash and extension
      const r2Url = `${ASSETS_CDN}/${entry.data.hash}.${entry.data.ext}`;

      try {
        // Fetch from R2 and proxy the response (don't follow redirects)
        const response = await fetch(r2Url, { redirect: "manual" });

        // Check for redirects (3xx status codes) - indicates R2 bucket misconfiguration
        if (response.status >= 300 && response.status < 400) {
          console.error(
            `[middleware] R2 bucket misconfigured - got ${response.status} redirect for ${assetPath}. ` +
              `Check your R2 custom domain setup for assets.just-be.dev`
          );
          // Fall through to let static file handler or 404 take over
        } else if (response.ok) {
          // Read the response body as arrayBuffer to properly proxy it
          const body = await response.arrayBuffer();

          // Create new headers with proper content type and caching
          const headers = new Headers();
          headers.set(
            "Content-Type",
            response.headers.get("Content-Type") || "application/octet-stream"
          );
          headers.set("Cache-Control", "public, max-age=31536000, immutable");
          headers.set("Content-Length", body.byteLength.toString());

          return new Response(body, {
            status: 200,
            headers,
          });
        }
      } catch (error) {
        console.error(`[middleware] Failed to proxy asset ${assetPath}:`, error);
      }
    }

    // If asset not found in manifest or fetch failed, continue to next middleware
    // This allows local files in public/assets to be served normally
  }

  // Handle redirects from redirects collection
  const redirects = await getCollection("redirects");
  const redirect = redirects.find((r) => r.id === url.pathname);
  if (redirect) {
    const status = redirect.data.permanent ? 301 : 302;
    return context.redirect(redirect.data.to, status);
  }

  // Check if first or second path segment is a code (format: [brpt][0-9a-f]{4})
  const codePattern = /^[brpt][0-9a-f]{4}$/i;
  const firstSegmentIsCode = pathSegments[0] && codePattern.test(pathSegments[0]);
  const secondSegmentIsCode = pathSegments[1] && codePattern.test(pathSegments[1]);

  if (firstSegmentIsCode || secondSegmentIsCode) {
    const code = (firstSegmentIsCode ? pathSegments[0] : pathSegments[1]).toLowerCase();

    // Load the URL manifest to find the canonical page
    const entries = await getCollection("urls");
    const matchingEntry = entries.find((entry) => entry.data.code === code);

    if (matchingEntry) {
      // The manifest ID is the canonical URL path (e.g., "/blog/slug")
      const newUrl = new URL(url);
      newUrl.pathname = matchingEntry.id;
      return context.redirect(newUrl.toString(), 301);
    }
  }

  // All other URLs pass through
  return next();
});
