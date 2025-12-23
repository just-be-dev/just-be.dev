import { defineMiddleware } from "astro:middleware";
import { getCollection } from "astro:content";
import { Code } from "@/utils/code";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // Handle /blog/*, /projects/*, /research/*, and /talks/* paths
  const match = url.pathname.match(/^\/(blog|projects|research|talks)\//);
  const matchedType = match?.[1] as "blog" | "projects" | "research" | "talks" | undefined;

  if (!matchedType) {
    return next();
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    return next();
  }

  // Extract the code from the URL (first segment after collection name)
  const urlCode = parts[1];

  // Find the entry by matching the code (first 5 characters of the ID)
  const entry = (
    await getCollection(matchedType, ({ id }) => {
      return urlCode.slice(0, 5).toLowerCase() === id.slice(0, 5).toLowerCase();
    })
  ).at(0);

  if (entry) {
    const { code, slug } = Code.parseId(entry.id);
    const correctPath = `/${matchedType}/${code}/${slug}/`;

    // Check if we're already on the correct path
    if (url.pathname === correctPath) {
      return next();
    }

    // Redirect to the correct URL format
    const newUrl = new URL(url);
    newUrl.pathname = correctPath;
    return context.redirect(newUrl.toString());
  }

  // No match found, let it pass through (will 404)
  return next();
});
