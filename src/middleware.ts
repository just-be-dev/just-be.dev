import { defineMiddleware } from "astro:middleware";
import { getCollection } from "astro:content";
import { aliasTarget, canonicalPath } from "@/utils/url-manifest";
import { projectAliasPath, projectCodePath } from "@/utils/projects";

interface CodeTarget {
  pathname: string;
  status: 301 | 302;
}

/** Blog, research, talk and game codes resolve through the build-time URL manifest. */
async function manifestTarget(code: string): Promise<CodeTarget | undefined> {
  const pathname = canonicalPath(code, await getCollection("urls"));
  return pathname ? { pathname, status: 301 } : undefined;
}

/**
 * Project codes are owned by Desk and resolve at request time, to the page the
 * projects join picks. The target can change (a Desk slug or site link), so the
 * redirect is temporary. Imported lazily: it reaches the Worker env, which
 * prerendered pages never need.
 */
async function projectCodeTarget(code: string): Promise<CodeTarget | undefined> {
  const { loadProjects } = await import("@/utils/site-projects");
  const { projects } = await loadProjects();
  const pathname = projectCodePath(code, projects);
  return pathname ? { pathname, status: 302 } : undefined;
}

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

  // Check if first or second path segment is a code (format: [bgrpt][0-9a-f]{4})
  const codePattern = /^[bgrpt][0-9a-f]{4}$/i;
  const firstSegmentIsCode = pathSegments[0] && codePattern.test(pathSegments[0]);
  const secondSegmentIsCode = pathSegments[1] && codePattern.test(pathSegments[1]);

  if (firstSegmentIsCode || secondSegmentIsCode) {
    const code = (firstSegmentIsCode ? pathSegments[0] : pathSegments[1]).toLowerCase();
    const target = code.startsWith("p")
      ? await projectCodeTarget(code)
      : await manifestTarget(code);

    if (target) {
      const newUrl = new URL(url);
      newUrl.pathname = target.pathname;
      return context.redirect(newUrl.toString(), target.status);
    }
  }

  // Frontmatter `slugs` aliases (e.g. /pex) redirect to the content's page.
  // Project aliases come from the projects' MDX; other kinds use the manifest.
  const alias =
    projectAliasPath(url.pathname, await getCollection("projects")) ??
    aliasTarget(url.pathname, await getCollection("urls"));
  if (alias) {
    const newUrl = new URL(url);
    newUrl.pathname = alias;
    return context.redirect(newUrl.toString(), 301);
  }

  // All other URLs pass through
  return next();
});
