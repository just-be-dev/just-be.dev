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
 * Add CORS headers to response if the origin is from *.just-be.dev
 */
function addCorsHeaders(response: Response, request: Request): Response {
  const origin = request.headers.get("Origin");

  // Check if origin is from just-be.dev or any subdomain
  if (origin) {
    const originUrl = new URL(origin);
    const hostname = originUrl.hostname;

    // Allow just-be.dev and any subdomain (*.just-be.dev)
    if (hostname === "just-be.dev" || hostname.endsWith(".just-be.dev")) {
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
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin");
      if (origin) {
        const originUrl = new URL(origin);
        const hostname = originUrl.hostname;

        // Allow just-be.dev and any subdomain
        if (hostname === "just-be.dev" || hostname.endsWith(".just-be.dev")) {
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
        case "static":
          response = await handleStatic(request, config, { fileLoader });
          break;

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
