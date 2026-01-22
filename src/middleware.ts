import { defineMiddleware } from "astro:middleware";
import { getCollection, getEntry } from "astro:content";
import { Code, KIND_TO_COLLECTION, type Kind, type Collection } from "@/utils/code";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const kindChars = Object.keys(KIND_TO_COLLECTION).join("").toLowerCase();
  const collections = Object.values(KIND_TO_COLLECTION).join("|");

  // Handle old code-based URLs like /blog/b2405/slug -> /blog/slug
  // Check this first since it doesn't need manifest lookup
  const oldCodePattern = new RegExp(
    `^\\/(${collections})\\/([${kindChars}][0-9a-f]{4})\\/([^\/]+)\\/?$`,
    "i"
  );
  const oldCodeMatch = url.pathname.match(oldCodePattern);
  if (oldCodeMatch) {
    const collection = oldCodeMatch[1];
    const slug = oldCodeMatch[3];
    const newUrl = new URL(url);
    newUrl.pathname = `/${collection}/${slug}`;
    return context.redirect(newUrl.toString(), 301);
  }

  // For short codes and custom slugs, we need to load the manifest
  const shortCodePattern = new RegExp(`^\\/([${kindChars}][0-9a-f]{4})\\/?$`, "i");
  const shortCodeMatch = url.pathname.match(shortCodePattern);

  // Check if URL could potentially need a redirect (short code, custom slug, or legacy code-based URL)
  // We need to check the manifest for collection paths to handle legacy URLs like /projects/p1e73
  const isCollectionPath = url.pathname.match(new RegExp(`^\\/(${collections})\\/[^\\/]+\\/?$`));
  const needsManifest = shortCodeMatch || isCollectionPath || url.pathname.length > 1;

  if (needsManifest) {
    const entries = await getCollection("urls");

    // Handle short code URLs like /b232e -> /blog/slug
    if (shortCodeMatch) {
      const shortCode = shortCodeMatch[1].toLowerCase();
      const kindChar = shortCode[0].toUpperCase() as Kind;
      const collection = KIND_TO_COLLECTION[kindChar];

      const matchingEntry = entries.find((entry) => entry.data.code === shortCode);

      if (matchingEntry) {
        // Extract slug from the manifest ID (which is /{collection}/{slug})
        const slug = matchingEntry.id.replace(`/${collection}/`, "");
        const newUrl = new URL(url);
        newUrl.pathname = `/${collection}/${slug}`;
        return context.redirect(newUrl.toString(), 301);
      }

      // No match, continue to 404
      return next();
    }

    // Handle custom slug redirects like /ccpm -> /projects/ccpm
    const currentPath = url.pathname.replace(/\/$/, ""); // Remove trailing slash for comparison

    // Find if current path matches any manifest entry
    const matchingEntry = entries.find((entry) => {
      const entryPath = entry.id.replace(/\/$/, "");
      return entryPath === currentPath;
    });

    if (matchingEntry) {
      // Get all URLs for this code
      const code = matchingEntry.data.code;
      const allUrlsForCode = entries.filter((e) => e.data.code === code);

      // Find the canonical URL (should match /{collection}/{slug} pattern)
      const canonicalEntry = allUrlsForCode.find((e) => {
        const entryPath = e.id.replace(/\/$/, "");
        return new RegExp(`^\\/(${collections})\\/[^\\/]+$`).test(entryPath);
      });

      // If we found a canonical URL and it's different from current path, redirect
      if (canonicalEntry && canonicalEntry.id !== matchingEntry.id) {
        const newUrl = new URL(url);
        newUrl.pathname = canonicalEntry.id;
        return context.redirect(newUrl.toString(), 301);
      }
    }
  }

  // All other URLs pass through (including canonical slug-based URLs)
  return next();
});
