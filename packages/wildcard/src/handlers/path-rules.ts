import type { StaticConfig } from "../schemas";
import { matchPath, proxyRequest } from "../utils";

/**
 * Handles path-level redirects and rewrites for static handlers
 * Returns a Response if a rule matches, or null to continue to static file serving
 */
export async function handlePathRules(
  request: Request,
  config: StaticConfig,
): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Check redirects first (in array order)
  if (config.redirects?.length) {
    for (const rule of config.redirects) {
      const match = matchPath(rule.path, pathname);
      if (!match.matched) continue;

      // Build target URL, appending suffix for wildcard patterns
      let targetUrl = rule.url;
      if (rule.path.endsWith("/*") && match.suffix && match.suffix !== "/") {
        targetUrl = rule.url.replace(/\/$/, "") + match.suffix;
      }

      return Response.redirect(targetUrl, rule.permanent ? 301 : 302);
    }
  }

  // Check rewrites (in array order)
  if (config.rewrites?.length) {
    for (const rule of config.rewrites) {
      const match = matchPath(rule.path, pathname);
      if (!match.matched) continue;

      // Check HTTP method
      if (!(rule.allowedMethods as string[]).includes(request.method)) {
        return new Response("Method not allowed", {
          status: 405,
          headers: {
            Allow: rule.allowedMethods.join(", "),
          },
        });
      }

      // Build target URL for rewrite
      const targetUrl = new URL(rule.url);

      // For wildcard patterns, use the suffix as the path
      // For exact patterns, use the original pathname
      if (rule.path.endsWith("/*") && match.suffix) {
        targetUrl.pathname = match.suffix;
      } else {
        targetUrl.pathname = url.pathname;
      }

      targetUrl.search = url.search;

      return proxyRequest(request, targetUrl);
    }
  }

  // No path rule matched, continue to static file serving
  return null;
}
