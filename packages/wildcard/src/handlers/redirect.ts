import type { Handler } from "../types";
import type { RedirectConfig } from "../schemas";

export const handleRedirect: Handler<RedirectConfig> = async (request, config) => {
  const status = config.permanent ? 301 : 302;

  if (config.preservePath) {
    const originalUrl = new URL(request.url);
    const targetUrl = new URL(config.url);
    targetUrl.pathname = targetUrl.pathname.replace(/\/$/, "") + originalUrl.pathname;
    targetUrl.search = originalUrl.search;
    return Response.redirect(targetUrl.toString(), status);
  }

  return Response.redirect(config.url, status);
};
