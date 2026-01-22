import { defineMiddleware } from "astro:middleware";
import { getCollection } from "astro:content";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const pathSegments = pathname.split("/").filter(Boolean);

  // Load the URL manifest
  const entries = await getCollection("urls");

  // Check if first or second path segment is a short code (format: [brpt][0-9a-f]{4})
  const codePattern = /^[brpt][0-9a-f]{4}$/i;
  const firstSegmentIsCode = pathSegments[0] && codePattern.test(pathSegments[0]);
  const secondSegmentIsCode = pathSegments[1] && codePattern.test(pathSegments[1]);

  if (firstSegmentIsCode || secondSegmentIsCode) {
    const code = (firstSegmentIsCode ? pathSegments[0] : pathSegments[1]).toLowerCase();

    // Find the canonical URL for this code
    const allEntriesForCode = entries.filter((entry) => entry.data.code === code);
    const canonicalEntry = allEntriesForCode.find((entry) => {
      // Canonical URLs have the format /{collection}/{slug}
      const segments = entry.id.split("/").filter(Boolean);
      return segments.length === 2;
    });

    if (canonicalEntry) {
      const newUrl = new URL(url);
      newUrl.pathname = canonicalEntry.id;
      return context.redirect(newUrl.toString(), 301);
    }
  }

  // Check if this exact path is in the manifest (for custom short URLs)
  const matchingEntry = entries.find((entry) => entry.id === pathname);

  if (matchingEntry) {
    const code = matchingEntry.data.code;

    // Find the canonical URL for this code
    const allEntriesForCode = entries.filter((entry) => entry.data.code === code);
    const canonicalEntry = allEntriesForCode.find((entry) => {
      // Canonical URLs have the format /{collection}/{slug}
      const segments = entry.id.split("/").filter(Boolean);
      return segments.length === 2;
    });

    if (canonicalEntry && canonicalEntry.id !== pathname) {
      // This is not the canonical URL, redirect to it
      const newUrl = new URL(url);
      newUrl.pathname = canonicalEntry.id;
      return context.redirect(newUrl.toString(), 301);
    }
  }

  // All other URLs pass through
  return next();
});
