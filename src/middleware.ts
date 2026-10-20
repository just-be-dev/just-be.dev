import { defineMiddleware } from "astro:middleware";
import { getCollection } from "astro:content";
import { aliasTarget, canonicalPath } from "@/utils/url-manifest";

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

  // Short codes (e.g. /p2530) and frontmatter `slugs` aliases (e.g. /pex)
  // redirect to the content's canonical page, via the URL manifest.
  const manifest = await getCollection("urls");

  if (firstSegmentIsCode || secondSegmentIsCode) {
    const code = (firstSegmentIsCode ? pathSegments[0] : pathSegments[1]).toLowerCase();
    const target = canonicalPath(code, manifest);

    if (target) {
      const newUrl = new URL(url);
      newUrl.pathname = target;
      return context.redirect(newUrl.toString(), 301);
    }
  }

  const alias = aliasTarget(url.pathname, manifest);
  if (alias) {
    const newUrl = new URL(url);
    newUrl.pathname = alias;
    return context.redirect(newUrl.toString(), 301);
  }

  // All other URLs pass through
  return next();
});
