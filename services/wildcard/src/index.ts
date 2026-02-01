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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
      switch (config.type) {
        case "static":
          return await handleStatic(request, config, { fileLoader });

        case "redirect":
          return await handleRedirect(request, config);

        case "rewrite":
          return await handleRewrite(request, config);

        default:
          return new Response("Service configuration error", { status: 500 });
      }
    } catch (error) {
      console.error("Handler error:", { subdomain, type: config.type, error });
      return new Response("Internal server error", { status: 500 });
    }
  },
};
