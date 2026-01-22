import { defineMiddleware } from "astro:middleware";
import { getCollection } from "astro:content";
import { Code, KIND_TO_COLLECTION, type Kind, type Collection } from "@/utils/code";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // Handle short code URLs like /b232e -> /blog/b232e/slug/
  const kindChars = Object.keys(KIND_TO_COLLECTION).join("").toLowerCase();
  const shortCodePattern = new RegExp(`^\\/([${kindChars}][0-9a-f]{4})\\/?$`, "i");
  const shortCodeMatch = url.pathname.match(shortCodePattern);
  if (shortCodeMatch) {
    const shortCode = shortCodeMatch[1].toLowerCase();
    const kindChar = shortCode[0].toUpperCase() as Kind;
    const collection = KIND_TO_COLLECTION[kindChar];

    const entry = (
      await getCollection(collection, ({ data }) => {
        return data.code && shortCode === data.code.toLowerCase();
      })
    ).at(0);

    if (entry) {
      const code = entry.data.code;
      const slug = entry.id;
      const newUrl = new URL(url);
      newUrl.pathname = `/${collection}/${code}/${slug}/`;
      return context.redirect(newUrl.toString(), 301);
    }

    // No match, continue to 404
    return next();
  }

  // Handle /blog/*, /projects/*, /research/*, and /talks/* paths
  const collections = Object.values(KIND_TO_COLLECTION).join("|");
  const collectionPattern = new RegExp(`^\\/(${collections})\\/`);
  const match = url.pathname.match(collectionPattern);
  const matchedType = match?.[1] as Collection | undefined;

  if (!matchedType) {
    return next();
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    return next();
  }

  // Extract the code from the URL (first segment after collection name)
  const urlCode = parts[1];

  // Find the entry by matching the code from frontmatter
  const entry = (
    await getCollection(matchedType, ({ data }) => {
      return data.code && urlCode.toLowerCase() === data.code.toLowerCase();
    })
  ).at(0);

  if (entry) {
    const code = entry.data.code;
    const slug = entry.id;
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
