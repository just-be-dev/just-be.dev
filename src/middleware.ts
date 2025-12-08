import { defineMiddleware } from "astro:middleware";
import { getCollection } from "astro:content";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // Handle /blog/*, /projects/*, and /research/* paths
  const match = url.pathname.match(/^\/(blog|projects|research)\//);
  const matchedType = match?.[1] as "blog" | "projects" | "research" | undefined;

  if (!matchedType) {
    return next();
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    return next();
  }

  const slug = parts[1];
  const entry = (
    await getCollection(matchedType, ({ id }) => {
      return slug.slice(0, 5).toLowerCase() === id.slice(0, 5).toLowerCase();
    })
  ).at(0);

  if (entry) {
    // We're going to the right page, continue
    if (context.props.id === entry.id) return next();
    // Redirect to the full ID
    const newUrl = new URL(url);
    newUrl.pathname = `/${matchedType}/${entry.id}/`;
    return context.redirect(newUrl.toString());
  }

  // No match found, let it pass through (will 404)
  return next();
});
