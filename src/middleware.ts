import { defineMiddleware } from "astro:middleware";
import { getCollection } from "astro:content";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const pathSegments = url.pathname.split("/").filter(Boolean);

  // Handle redirects from redirects collection
  const redirects = await getCollection("redirects");

  // First try exact match
  let redirect = redirects.find((r) => r.id === url.pathname);

  // If no exact match, try prefix matches with preservePath
  if (!redirect) {
    for (const r of redirects) {
      if (r.data.preservePath && url.pathname.startsWith(r.id)) {
        const remainingPath = url.pathname.slice(r.id.length);
        const target = r.data.to + remainingPath;
        const status = r.data.permanent ? 301 : 302;
        return context.redirect(target, status);
      }
    }
  }

  // Handle exact match redirect
  if (redirect) {
    const status = redirect.data.permanent ? 301 : 302;
    return context.redirect(redirect.data.to, status);
  }

  // Check if first or second path segment is a code (format: [brpt][0-9a-f]{4})
  const codePattern = /^[bgrpt][0-9a-f]{4}$/i;
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
