import type { Handler } from "../types";
import type { RedirectConfig } from "../schemas";

export const handleRedirect: Handler<RedirectConfig> = async (_request, config) => {
  const status = config.permanent ? 301 : 302;
  return Response.redirect(config.url, status);
};
