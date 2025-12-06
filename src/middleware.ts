import { defineMiddleware } from "astro:middleware";
import { getCollection } from "astro:content";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // Only handle /blog/* paths
  if (!url.pathname.startsWith("/blog/")) {
    return next();
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    return next();
  }

  const slug = parts[1];
  const post = (
    await getCollection("blog", ({ id }) => {
      return slug.slice(0, 4).toLowerCase() === id.slice(0, 4).toLowerCase();
    })
  ).at(0);

  if (post) {
    // We're going to the right page, continue
    if (context.props.id === post.id) return next();
    // Redirect to the full ID
    const newUrl = new URL(url);
    newUrl.pathname = `/blog/${post.id}/`;
    return context.redirect(newUrl.toString());
  }

  // No match found, let it pass through (will 404)
  return next();
});
