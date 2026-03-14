import {
  RouteConfigCodec,
  handleStatic,
  handleRedirect,
  handleRewrite,
  isValidSubdomain,
} from "@just-be/wildcard";
import { z } from "zod";
import { createR2FileLoader, createKVRouteConfigLoader, type Env } from "./adapters";

export type { Env };

/**
 * Add CORS headers to response if the origin is from allowed domains
 */
function addCorsHeaders(response: Response, request: Request): Response {
  const origin = request.headers.get("Origin");

  // Check if origin is from allowed domains
  if (origin) {
    const originUrl = new URL(origin);
    const hostname = originUrl.hostname;

    // Allow just-be.dev, *.just-be.dev, *.just-be.workers.dev, and localhost (dev)
    const isAllowed =
      hostname === "just-be.dev" ||
      hostname.endsWith(".just-be.dev") ||
      hostname.endsWith(".just-be.workers.dev") ||
      hostname === "localhost";

    if (isAllowed) {
      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
  }

  return response;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin");
      if (origin) {
        const originUrl = new URL(origin);
        const hostname = originUrl.hostname;

        // Allow just-be.dev, *.just-be.dev, *.just-be.workers.dev, and localhost (dev)
        const isAllowed =
          hostname === "just-be.dev" ||
          hostname.endsWith(".just-be.dev") ||
          hostname.endsWith(".just-be.workers.dev") ||
          hostname === "localhost";

        if (isAllowed) {
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": origin,
              "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
              "Access-Control-Max-Age": "86400",
            },
          });
        }
      }
    }

    const url = new URL(request.url);
    const hostname = url.hostname;

    const originHostname = new URL(env.ORIGIN_URL).hostname;

    // Build subdomain pattern with strict matching
    const escapedDomain = originHostname.replace(/\./g, "\\.");
    const subdomainPattern = new RegExp(`^([a-z0-9-]{1,63})\\.${escapedDomain}$`, "i");
    const subdomainMatch = hostname.match(subdomainPattern);

    if (!subdomainMatch) {
      return Response.redirect(env.ORIGIN_URL, 302);
    }

    const subdomain = subdomainMatch[1].toLowerCase();

    // Validate subdomain format (prevents ReDoS and invalid subdomains)
    if (!isValidSubdomain(subdomain)) {
      return Response.redirect(env.ORIGIN_URL, 302);
    }

    // Create adapters for this request
    const fileLoader = createR2FileLoader(env.CONTENT_BUCKET);
    const routeConfigLoader = createKVRouteConfigLoader(env.ROUTING_RULES);

    const routeConfig = await routeConfigLoader.loadRouteConfig(subdomain);

    if (!routeConfig) {
      return Response.redirect(env.ORIGIN_URL, 302);
    }

    const result = RouteConfigCodec.safeDecode(routeConfig);

    if (!result.success) {
      console.error("Configuration validation failed:", {
        subdomain,
        error: z.prettifyError(result.error),
      });
      return new Response("Service configuration error", { status: 500 });
    }

    const config = result.data;

    try {
      let response: Response;

      switch (config.type) {
        case "static": {
          // Cache API for static assets (only for GET/HEAD requests)
          const shouldCache = request.method === "GET" || request.method === "HEAD";
          const cache = caches.default;

          if (shouldCache) {
            // Check cache first
            const cachedResponse = await cache.match(request);
            if (cachedResponse) {
              return addCorsHeaders(cachedResponse, request);
            }
          }

          // Cache miss or non-cacheable method - handle normally
          response = await handleStatic(request, config, { fileLoader });

          // Store successful responses in cache
          if (shouldCache && response.ok) {
            ctx.waitUntil(cache.put(request, response.clone()));
          }
          break;
        }

        case "redirect":
          response = await handleRedirect(request, config);
          break;

        case "rewrite":
          response = await handleRewrite(request, config);
          break;

        default:
          response = new Response("Service configuration error", { status: 500 });
      }

      return addCorsHeaders(response, request);
    } catch (error) {
      console.error("Handler error:", { subdomain, type: config.type, error });
      return new Response("Internal server error", { status: 500 });
    }
  },
};
