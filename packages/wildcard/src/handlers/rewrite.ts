import type { Handler } from "../types";
import type { RewriteConfig } from "../schemas";
import { proxyRequest } from "../utils";

export const handleRewrite: Handler<RewriteConfig> = async (request, config) => {
  const originalUrl = new URL(request.url);
  const { url: targetUrl, allowedMethods } = config;

  if (!(allowedMethods as string[]).includes(request.method)) {
    return new Response("Method not allowed", {
      status: 405,
      headers: {
        Allow: allowedMethods.join(", "),
      },
    });
  }

  // Construct the target URL with the original path and query
  const url = new URL(targetUrl);
  url.pathname = originalUrl.pathname;
  url.search = originalUrl.search;

  return proxyRequest(request, url);
};
