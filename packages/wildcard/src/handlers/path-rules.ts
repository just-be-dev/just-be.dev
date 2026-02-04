import type { StaticConfig, PathRewrite } from "../schemas";
import { matchPath, filterSafeHeaders } from "../utils";

const FETCH_TIMEOUT_MS = 5_000;

/**
 * Handles path-level redirects and rewrites for static handlers
 * Returns a Response if a rule matches, or null to continue to static file serving
 */
export async function handlePathRules(
  request: Request,
  config: StaticConfig
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

      return handleRewrite(request, rule, url, match.suffix);
    }
  }

  // No path rule matched, continue to static file serving
  return null;
}

/**
 * Handle a rewrite rule by proxying the request to the target URL
 */
async function handleRewrite(
  request: Request,
  rule: PathRewrite,
  originalUrl: URL,
  suffix?: string
): Promise<Response> {
  const targetUrl = new URL(rule.url);

  // For wildcard patterns, use the suffix as the path
  // For exact patterns, use the original pathname
  if (rule.path.endsWith("/*") && suffix) {
    targetUrl.pathname = suffix;
  } else {
    targetUrl.pathname = originalUrl.pathname;
  }

  targetUrl.search = originalUrl.search;

  // Filter headers to only include safe ones (prevents header injection)
  const safeHeaders = filterSafeHeaders(request.headers);

  // Create a new request with the target URL and filtered headers
  const modifiedRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers: safeHeaders,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
  });

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(modifiedRequest, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Create a new response with the same body but potentially modified headers
    const newResponse = new Response(response.body, response);

    // Remove content-encoding header because the response body is already decoded
    // by the fetch API, and if we forward this header, the browser will try to
    // decode it again, causing corruption
    newResponse.headers.delete("content-encoding");

    return newResponse;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      return new Response("Request timeout", { status: 504 });
    }

    return new Response("Bad gateway", { status: 502 });
  }
}
